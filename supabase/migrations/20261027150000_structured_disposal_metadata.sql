-- Store disposal cause and final route as queryable fields on both ledgers.
ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS disposition_cause text,
  ADD COLUMN IF NOT EXISTS disposal_route text;

ALTER TABLE public.inventory_fractional_movements
  ADD COLUMN IF NOT EXISTS disposition_cause text,
  ADD COLUMN IF NOT EXISTS disposal_route text;

-- Recover the structured values from disposal records created by the previous RPC.
UPDATE public.stock_movements
SET disposition_cause = CASE
      WHEN reason LIKE '[BAJA: Vencimiento |%' THEN 'expired'
      WHEN reason LIKE '[BAJA: Daño o deterioro |%' THEN 'damaged'
      WHEN reason LIKE '[BAJA: Alerta de calidad / retiro |%' THEN 'quality_alert'
      WHEN reason LIKE '[BAJA: Desviación de temperatura |%' THEN 'temperature_excursion'
      WHEN reason LIKE '[BAJA: Contaminación |%' THEN 'contamination'
      WHEN reason LIKE '[BAJA: Otro |%' THEN 'other'
      ELSE disposition_cause
    END,
    disposal_route = CASE
      WHEN position('DISPOSICIÓN FINAL: Gestor de residuos biosanitarios]' IN reason) > 0 THEN 'biohazard_waste'
      WHEN position('DISPOSICIÓN FINAL: Devolución al proveedor]' IN reason) > 0 THEN 'supplier_return'
      WHEN position('DISPOSICIÓN FINAL: Programa posconsumo]' IN reason) > 0 THEN 'post_consumer_program'
      WHEN position('DISPOSICIÓN FINAL: Destrucción autorizada]' IN reason) > 0 THEN 'authorized_destruction'
      WHEN position('DISPOSICIÓN FINAL: Otro método]' IN reason) > 0 THEN 'other'
      ELSE disposal_route
    END
WHERE movement_type = 'discard';

UPDATE public.inventory_fractional_movements
SET disposition_cause = CASE
      WHEN reason LIKE '[BAJA: Vencimiento |%' THEN 'expired'
      WHEN reason LIKE '[BAJA: Daño o deterioro |%' THEN 'damaged'
      WHEN reason LIKE '[BAJA: Alerta de calidad / retiro |%' THEN 'quality_alert'
      WHEN reason LIKE '[BAJA: Desviación de temperatura |%' THEN 'temperature_excursion'
      WHEN reason LIKE '[BAJA: Contaminación |%' THEN 'contamination'
      WHEN reason LIKE '[BAJA: Otro |%' THEN 'other'
      ELSE disposition_cause
    END,
    disposal_route = CASE
      WHEN position('DISPOSICIÓN FINAL: Gestor de residuos biosanitarios]' IN reason) > 0 THEN 'biohazard_waste'
      WHEN position('DISPOSICIÓN FINAL: Devolución al proveedor]' IN reason) > 0 THEN 'supplier_return'
      WHEN position('DISPOSICIÓN FINAL: Programa posconsumo]' IN reason) > 0 THEN 'post_consumer_program'
      WHEN position('DISPOSICIÓN FINAL: Destrucción autorizada]' IN reason) > 0 THEN 'authorized_destruction'
      WHEN position('DISPOSICIÓN FINAL: Otro método]' IN reason) > 0 THEN 'other'
      ELSE disposal_route
    END
WHERE movement_type = 'discard';

ALTER TABLE public.stock_movements
  DROP CONSTRAINT IF EXISTS stock_movements_disposition_cause_check,
  DROP CONSTRAINT IF EXISTS stock_movements_disposal_route_check;
ALTER TABLE public.stock_movements
  ADD CONSTRAINT stock_movements_disposition_cause_check CHECK (
    disposition_cause IS NULL OR disposition_cause IN (
      'expired', 'damaged', 'quality_alert', 'temperature_excursion', 'contamination', 'other'
    )
  ),
  ADD CONSTRAINT stock_movements_disposal_route_check CHECK (
    disposal_route IS NULL OR disposal_route IN (
      'biohazard_waste', 'supplier_return', 'post_consumer_program', 'authorized_destruction', 'other'
    )
  );

ALTER TABLE public.inventory_fractional_movements
  DROP CONSTRAINT IF EXISTS inventory_fractional_movements_disposition_cause_check,
  DROP CONSTRAINT IF EXISTS inventory_fractional_movements_disposal_route_check;
ALTER TABLE public.inventory_fractional_movements
  ADD CONSTRAINT inventory_fractional_movements_disposition_cause_check CHECK (
    disposition_cause IS NULL OR disposition_cause IN (
      'expired', 'damaged', 'quality_alert', 'temperature_excursion', 'contamination', 'other'
    )
  ),
  ADD CONSTRAINT inventory_fractional_movements_disposal_route_check CHECK (
    disposal_route IS NULL OR disposal_route IN (
      'biohazard_waste', 'supplier_return', 'post_consumer_program', 'authorized_destruction', 'other'
    )
  );

CREATE INDEX IF NOT EXISTS idx_stock_movements_disposal_metadata
  ON public.stock_movements (disposition_cause, disposal_route)
  WHERE movement_type = 'discard';
CREATE INDEX IF NOT EXISTS idx_fractional_movements_disposal_metadata
  ON public.inventory_fractional_movements (disposition_cause, disposal_route)
  WHERE movement_type = 'discard';

CREATE OR REPLACE FUNCTION public.fn_discard_inventory_batch(
  p_batch_id uuid,
  p_quantity_packages integer,
  p_opened_units integer,
  p_disposed_by uuid,
  p_disposition_method text,
  p_disposal_route text,
  p_reason text,
  p_request_id uuid DEFAULT gen_random_uuid()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch public.inventory_batches%ROWTYPE;
  v_method_label text;
  v_route_label text;
  v_final_reason text;
  v_request_payload jsonb;
  v_existing_payload jsonb;
  v_existing_user_id uuid;
  v_existing_batch_id uuid;
  v_claimed boolean;
BEGIN
  IF auth.uid() IS NULL OR p_disposed_by IS NULL OR auth.uid() IS DISTINCT FROM p_disposed_by
     OR public.fn_get_user_role() NOT IN ('admin', 'supervisor') THEN
    RAISE EXCEPTION 'Unauthorized inventory disposal' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_request_id IS NULL OR p_batch_id IS NULL
     OR p_quantity_packages IS NULL OR p_quantity_packages < 0
     OR p_opened_units IS NULL OR p_opened_units < 0
     OR p_quantity_packages + p_opened_units <= 0
     OR nullif(trim(p_reason), '') IS NULL OR length(trim(p_reason)) < 8 OR length(trim(p_reason)) > 500 THEN
    RAISE EXCEPTION 'Invalid inventory disposal data' USING ERRCODE = 'check_violation';
  END IF;

  v_method_label := CASE p_disposition_method
    WHEN 'expired' THEN 'Vencimiento'
    WHEN 'damaged' THEN 'Daño o deterioro'
    WHEN 'quality_alert' THEN 'Alerta de calidad / retiro'
    WHEN 'temperature_excursion' THEN 'Desviación de temperatura'
    WHEN 'contamination' THEN 'Contaminación'
    WHEN 'other' THEN 'Otro'
    ELSE NULL
  END;
  IF v_method_label IS NULL THEN
    RAISE EXCEPTION 'Invalid inventory disposal cause' USING ERRCODE = 'check_violation';
  END IF;

  v_route_label := CASE p_disposal_route
    WHEN 'biohazard_waste' THEN 'Gestor de residuos biosanitarios'
    WHEN 'supplier_return' THEN 'Devolución al proveedor'
    WHEN 'post_consumer_program' THEN 'Programa posconsumo'
    WHEN 'authorized_destruction' THEN 'Destrucción autorizada'
    WHEN 'other' THEN 'Otro método'
    ELSE NULL
  END;
  IF v_route_label IS NULL THEN
    RAISE EXCEPTION 'Invalid final disposal method' USING ERRCODE = 'check_violation';
  END IF;

  v_request_payload := jsonb_build_object(
    'batch_id', p_batch_id,
    'quantity_packages', p_quantity_packages,
    'opened_units', p_opened_units,
    'disposition_method', p_disposition_method,
    'disposal_route', p_disposal_route,
    'reason', trim(p_reason)
  );

  INSERT INTO public.inventory_disposal_requests (request_id, user_id, batch_id, request_payload)
  VALUES (p_request_id, p_disposed_by, p_batch_id, v_request_payload)
  ON CONFLICT (request_id) DO NOTHING;
  v_claimed := FOUND;

  IF NOT v_claimed THEN
    SELECT request_payload, user_id, batch_id
    INTO v_existing_payload, v_existing_user_id, v_existing_batch_id
    FROM public.inventory_disposal_requests
    WHERE request_id = p_request_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Disposal request could not be claimed; retry the request'
        USING ERRCODE = 'serialization_failure';
    END IF;
    IF v_existing_user_id <> p_disposed_by OR v_existing_payload IS DISTINCT FROM v_request_payload THEN
      RAISE EXCEPTION 'Disposal request id was already used for different data'
        USING ERRCODE = 'unique_violation';
    END IF;
    RETURN v_existing_batch_id;
  END IF;

  SELECT * INTO v_batch
  FROM public.inventory_batches
  WHERE id = p_batch_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory batch not found' USING ERRCODE = 'no_data_found';
  END IF;
  IF p_quantity_packages > v_batch.current_stock THEN
    RAISE EXCEPTION 'Insufficient packages for disposal; available: %', v_batch.current_stock USING ERRCODE = 'check_violation';
  END IF;
  IF p_opened_units > coalesce(v_batch.opened_units_remaining, 0) THEN
    RAISE EXCEPTION 'Insufficient opened units for disposal; available: %', coalesce(v_batch.opened_units_remaining, 0) USING ERRCODE = 'check_violation';
  END IF;
  IF p_opened_units > 0 AND coalesce(v_batch.opened_units_per_package, 0) <= 1 THEN
    RAISE EXCEPTION 'Opened package presentation is not configured' USING ERRCODE = 'check_violation';
  END IF;

  v_final_reason := trim(p_reason);

  UPDATE public.inventory_batches
  SET opened_units_remaining = coalesce(opened_units_remaining, 0) - p_opened_units,
      opened_units_per_package = CASE
        WHEN coalesce(opened_units_remaining, 0) - p_opened_units = 0 THEN 0
        ELSE opened_units_per_package
      END
  WHERE id = p_batch_id;

  IF p_quantity_packages > 0 THEN
    INSERT INTO public.stock_movements (
      batch_id, user_id, movement_type, quantity, reason, disposition_cause, disposal_route
    ) VALUES (
      p_batch_id, p_disposed_by, 'discard', p_quantity_packages, v_final_reason,
      p_disposition_method, p_disposal_route
    );
  END IF;

  IF p_opened_units > 0 THEN
    INSERT INTO public.inventory_fractional_movements (
      batch_id, user_id, units_withdrawn, units_per_package, packages_opened, reason,
      movement_type, disposition_cause, disposal_route
    ) VALUES (
      p_batch_id, p_disposed_by, p_opened_units, v_batch.opened_units_per_package, 0,
      v_final_reason, 'discard', p_disposition_method, p_disposal_route
    );
  END IF;

  RETURN p_batch_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_discard_inventory_batch(uuid, integer, integer, uuid, text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_discard_inventory_batch(uuid, integer, integer, uuid, text, text, text, uuid) TO authenticated;

COMMENT ON FUNCTION public.fn_discard_inventory_batch(uuid, integer, integer, uuid, text, text, text, uuid)
  IS 'Atomically records authorized disposal with structured cause and route, once per request UUID.';

NOTIFY pgrst, 'reload schema';

-- Record disposal of whole packages and opened inner units atomically.
-- The batch row lock prevents concurrent exits from disposing the same stock twice.
ALTER TABLE public.inventory_fractional_movements
  ADD COLUMN IF NOT EXISTS movement_type text NOT NULL DEFAULT 'exit';

CREATE OR REPLACE FUNCTION public.fn_discard_inventory_batch(
  p_batch_id uuid,
  p_quantity_packages integer,
  p_opened_units integer,
  p_disposed_by uuid,
  p_disposition_method text,
  p_disposal_route text,
  p_reason text
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
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_disposed_by
     OR public.fn_get_user_role() NOT IN ('admin', 'supervisor') THEN
    RAISE EXCEPTION 'Unauthorized inventory disposal' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_batch_id IS NULL
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

  v_final_reason := format('[BAJA: %s | DISPOSICIÓN FINAL: %s] %s', v_method_label, v_route_label, trim(p_reason));

  -- Whole-package stock is maintained by the existing stock_movements trigger,
  -- just like normal consumption. Opened inner units live on the batch itself.
  UPDATE public.inventory_batches
  SET opened_units_remaining = coalesce(opened_units_remaining, 0) - p_opened_units,
      opened_units_per_package = CASE
        WHEN coalesce(opened_units_remaining, 0) - p_opened_units = 0 THEN 0
        ELSE opened_units_per_package
      END
  WHERE id = p_batch_id;

  IF p_quantity_packages > 0 THEN
    INSERT INTO public.stock_movements (batch_id, user_id, movement_type, quantity, reason)
    VALUES (p_batch_id, p_disposed_by, 'discard', p_quantity_packages, v_final_reason);
  END IF;

  IF p_opened_units > 0 THEN
    INSERT INTO public.inventory_fractional_movements (
      batch_id, user_id, units_withdrawn, units_per_package, packages_opened, reason, movement_type
    ) VALUES (
      p_batch_id, p_disposed_by, p_opened_units, v_batch.opened_units_per_package, 0, v_final_reason, 'discard'
    );
  END IF;

  RETURN p_batch_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_discard_inventory_batch(uuid, integer, integer, uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_discard_inventory_batch(uuid, integer, integer, uuid, text, text, text) TO authenticated;

COMMENT ON FUNCTION public.fn_discard_inventory_batch(uuid, integer, integer, uuid, text, text, text)
  IS 'Atomically records the authorized final disposal of whole and opened inventory units.';

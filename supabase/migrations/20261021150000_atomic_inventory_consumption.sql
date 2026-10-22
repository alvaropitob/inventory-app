-- Enforces usable lot status, expiration, FEFO justification and available
-- quantity while locking the batch and writing the exit movement atomically.
CREATE OR REPLACE FUNCTION public.fn_consume_inventory_batch(
  p_batch_id uuid,
  p_quantity integer,
  p_consumed_by uuid,
  p_reason text,
  p_equipment_name text DEFAULT NULL,
  p_mark_as_opened boolean DEFAULT false,
  p_reconstituted boolean DEFAULT false,
  p_fefo_deviation boolean DEFAULT false,
  p_justification_reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch public.inventory_batches%ROWTYPE;
  v_fefo_deviation boolean;
  v_final_reason text;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_consumed_by
     OR public.fn_get_user_role() NOT IN ('admin', 'operator') THEN
    RAISE EXCEPTION 'Unauthorized inventory consumption' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 OR nullif(trim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'Invalid consumption quantity or reason' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_batch FROM public.inventory_batches WHERE id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inventory batch not found' USING ERRCODE = 'no_data_found'; END IF;
  IF v_batch.current_stock < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock; available: %', v_batch.current_stock USING ERRCODE = 'check_violation';
  END IF;
  IF v_batch.expiration_date < CURRENT_DATE
     OR coalesce(v_batch.adjusted_expiration_date, v_batch.expiration_date) < CURRENT_DATE THEN
    RAISE EXCEPTION 'Expired batches cannot be consumed' USING ERRCODE = 'check_violation';
  END IF;
  IF v_batch.status::text IN ('quarantine', 'rejected', 'expired')
     OR v_batch.clinical_status::text IN ('quarantine', 'rejected', 'expired')
     OR (v_batch.status IS NOT NULL AND v_batch.status::text <> 'accepted')
     OR (v_batch.clinical_status IS NOT NULL AND v_batch.clinical_status::text <> 'accepted')
     OR (v_batch.status IS NULL AND v_batch.clinical_status IS NULL) THEN
    RAISE EXCEPTION 'Only accepted batches can be consumed' USING ERRCODE = 'check_violation';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.inventory_batches b
    WHERE b.item_id = v_batch.item_id
      AND b.id <> v_batch.id
      AND b.current_stock > 0
      AND b.expiration_date >= CURRENT_DATE
      AND coalesce(b.adjusted_expiration_date, b.expiration_date) >= CURRENT_DATE
      AND coalesce(b.adjusted_expiration_date, b.expiration_date) <
          coalesce(v_batch.adjusted_expiration_date, v_batch.expiration_date)
      AND (b.status IS NULL OR b.status::text = 'accepted')
      AND (b.clinical_status IS NULL OR b.clinical_status::text = 'accepted')
  ) INTO v_fefo_deviation;

  IF p_fefo_deviation AND NOT v_fefo_deviation THEN
    RAISE EXCEPTION 'The selected batch is no longer a FEFO deviation; refresh the inventory list'
      USING ERRCODE = 'serialization_failure';
  END IF;
  IF v_fefo_deviation AND nullif(trim(p_justification_reason), '') IS NULL THEN
    RAISE EXCEPTION 'FEFO deviation requires a technical justification' USING ERRCODE = 'check_violation';
  END IF;
  v_final_reason := CASE WHEN v_fefo_deviation
    THEN '[FEFO DEVIATION] ' || trim(p_justification_reason) || ' | Reason: ' || trim(p_reason)
    ELSE trim(p_reason)
  END;

  INSERT INTO public.stock_movements (
    batch_id, user_id, movement_type, quantity, reason, equipment_name
  ) VALUES (
    p_batch_id, p_consumed_by, 'exit', p_quantity, v_final_reason, p_equipment_name
  );

  UPDATE public.inventory_batches SET
    opening_date = CASE WHEN p_mark_as_opened AND opening_date IS NULL THEN now() ELSE opening_date END,
    reconstitution_datetime = CASE WHEN p_reconstituted THEN now() ELSE reconstitution_datetime END
  WHERE id = p_batch_id;

  RETURN p_batch_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_consume_inventory_batch(uuid, integer, uuid, text, text, boolean, boolean, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_consume_inventory_batch(uuid, integer, uuid, text, text, boolean, boolean, boolean, text) TO authenticated;

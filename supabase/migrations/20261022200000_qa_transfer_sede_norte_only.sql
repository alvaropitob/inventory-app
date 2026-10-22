CREATE OR REPLACE FUNCTION public.fn_transfer_inventory_batch(
  p_batch_id uuid,
  p_destination_location_id uuid,
  p_quantity integer,
  p_transferred_by uuid,
  p_reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source public.inventory_batches%ROWTYPE;
  v_target_id uuid;
  v_target public.inventory_batches%ROWTYPE;
  v_origin_name text;
  v_destination_name text;
  v_reason text;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_transferred_by
     OR public.fn_get_user_role() NOT IN ('admin', 'supervisor', 'operator') THEN
    RAISE EXCEPTION 'Unauthorized inventory transfer' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 OR p_destination_location_id IS NULL THEN
    RAISE EXCEPTION 'Invalid transfer quantity or destination' USING ERRCODE = 'check_violation';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.locations
    WHERE id = p_destination_location_id
      AND is_active = true
      AND lower(trim(name)) = lower('Sede Norte')
  ) THEN
    RAISE EXCEPTION 'Destination must be the active Sede Norte location' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_source
  FROM public.inventory_batches
  WHERE id = p_batch_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source batch not found' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_source.location_id = p_destination_location_id THEN
    RAISE EXCEPTION 'Destination must differ from source location' USING ERRCODE = 'check_violation';
  END IF;
  IF p_quantity > v_source.current_stock THEN
    RAISE EXCEPTION 'Insufficient source stock; available: %', v_source.current_stock USING ERRCODE = 'check_violation';
  END IF;

  SELECT name INTO v_origin_name FROM public.locations WHERE id = v_source.location_id;
  SELECT name INTO v_destination_name FROM public.locations WHERE id = p_destination_location_id;
  v_reason := concat_ws(' ', 'Traslado de', p_quantity, 'unidades desde', coalesce(v_origin_name, 'ubicación origen'),
    'hasta', v_destination_name || '.', nullif(trim(p_reason), ''));

  SELECT * INTO v_target
  FROM public.inventory_batches
  WHERE item_id = v_source.item_id
    AND batch_number = v_source.batch_number
    AND location_id = p_destination_location_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_target.expiration_date <> v_source.expiration_date
       OR v_target.supplier_id IS DISTINCT FROM v_source.supplier_id
       OR v_target.status <> v_source.status
       OR v_target.clinical_status IS DISTINCT FROM v_source.clinical_status
       OR v_target.acceptance_test_status <> v_source.acceptance_test_status THEN
      RAISE EXCEPTION 'Destination lot metadata does not match source lot' USING ERRCODE = 'check_violation';
    END IF;
    v_target_id := v_target.id;
  ELSIF p_quantity = v_source.current_stock THEN
    v_target_id := v_source.id;
  ELSE
    INSERT INTO public.inventory_batches (
      item_id, location_id, supplier_id, batch_number, expiration_date,
      initial_quantity, current_stock, status, clinical_status, acceptance_test_status,
      received_by, notes
    ) VALUES (
      v_source.item_id, p_destination_location_id, v_source.supplier_id,
      v_source.batch_number, v_source.expiration_date, p_quantity, 0,
      v_source.status, v_source.clinical_status, v_source.acceptance_test_status, p_transferred_by,
      concat('Lote destino creado por traslado desde ', coalesce(v_origin_name, 'ubicación origen'))
    ) RETURNING id INTO v_target_id;
  END IF;

  INSERT INTO public.stock_movements (batch_id, user_id, movement_type, quantity, reason)
  VALUES (v_source.id, p_transferred_by, 'exit', p_quantity, v_reason);

  IF v_target_id = v_source.id THEN
    UPDATE public.inventory_batches SET location_id = p_destination_location_id WHERE id = v_source.id;
  END IF;

  INSERT INTO public.stock_movements (batch_id, user_id, movement_type, quantity, reason)
  VALUES (v_target_id, p_transferred_by, 'entry', p_quantity, v_reason);

  RETURN v_target_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_transfer_inventory_batch(uuid, uuid, integer, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_transfer_inventory_batch(uuid, uuid, integer, uuid, text) TO authenticated;

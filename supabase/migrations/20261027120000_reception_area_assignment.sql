-- Creates a technical reception, stock movements, received quantities and
-- purchase order status changes in one database transaction.
CREATE OR REPLACE FUNCTION public.fn_register_technical_reception(
  p_order_id uuid,
  p_invoice_number text,
  p_packaging_status text,
  p_integrity_verified boolean,
  p_reception_temperature numeric,
  p_is_approved boolean,
  p_notes text,
  p_items jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_order public.purchase_orders%ROWTYPE;
  v_order_item public.purchase_order_items%ROWTYPE;
  v_item jsonb;
  v_item_id uuid;
  v_location_id uuid;
  v_quantity integer;
  v_unit_price numeric;
  v_lot_number text;
  v_expiration_date date;
  v_item_section_id uuid;
  v_selected_section_id uuid;
  v_section_active boolean;
  v_location_section_id uuid;
  v_location_active boolean;
  v_existing_batch public.inventory_batches%ROWTYPE;
  v_batch_id uuid;
  v_reception_id uuid;
  v_fully_received boolean;
  v_has_received boolean;
BEGIN
  IF v_user_id IS NULL OR public.fn_get_user_role() NOT IN ('admin', 'operator') THEN
    RAISE EXCEPTION 'Unauthorized technical reception' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_order_id IS NULL OR nullif(trim(p_invoice_number), '') IS NULL
     OR p_integrity_verified IS NULL OR p_is_approved IS NULL
     OR p_reception_temperature IS NULL THEN
    RAISE EXCEPTION 'Missing technical reception fields' USING ERRCODE = 'check_violation';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid reception item list' USING ERRCODE = 'check_violation';
  END IF;
  IF jsonb_array_length(p_items) < 1 OR jsonb_array_length(p_items) > 500 THEN
    RAISE EXCEPTION 'Invalid reception item count' USING ERRCODE = 'check_violation';
  END IF;
  IF (SELECT count(DISTINCT value->>'catalog_item_id') FROM jsonb_array_elements(p_items))
     <> jsonb_array_length(p_items) THEN
    RAISE EXCEPTION 'Duplicate products in technical reception' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_order FROM public.purchase_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Purchase order not found' USING ERRCODE = 'no_data_found'; END IF;
  IF v_order.status NOT IN ('requested', 'partially_received') THEN
    RAISE EXCEPTION 'Purchase order is not open for reception' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.technical_receptions (
    order_id, invoice_number, packaging_status, integrity_verified,
    reception_temperature, is_approved, notes
  ) VALUES (
    p_order_id, trim(p_invoice_number), p_packaging_status, p_integrity_verified,
    p_reception_temperature, p_is_approved, p_notes
  ) RETURNING id INTO v_reception_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    IF coalesce(v_item->>'catalog_item_id', '') = ''
       OR coalesce(v_item->>'location_id', '') = ''
       OR coalesce(v_item->>'lot_number', '') = ''
       OR coalesce(v_item->>'expiration_date', '') !~ '^\d{4}-\d{2}-\d{2}$'
       OR coalesce(v_item->>'quantity_received', '') !~ '^[1-9][0-9]*$'
       OR coalesce(v_item->>'unit_price', '') !~ '^[0-9]+(\.[0-9]+)?$' THEN
      RAISE EXCEPTION 'Invalid technical reception item' USING ERRCODE = 'check_violation';
    END IF;

    v_item_id := (v_item->>'catalog_item_id')::uuid;
    v_location_id := (v_item->>'location_id')::uuid;
    v_quantity := (v_item->>'quantity_received')::integer;
    v_unit_price := (v_item->>'unit_price')::numeric;
    v_lot_number := trim(v_item->>'lot_number');
    v_expiration_date := (v_item->>'expiration_date')::date;
    IF v_unit_price < 0 THEN RAISE EXCEPTION 'Invalid unit price' USING ERRCODE = 'check_violation'; END IF;

    SELECT * INTO v_order_item FROM public.purchase_order_items
    WHERE purchase_order_id = p_order_id AND item_id = v_item_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Product is not part of this purchase order' USING ERRCODE = 'check_violation'; END IF;
    IF v_quantity > v_order_item.quantity_requested - coalesce(v_order_item.quantity_received, 0) THEN
      RAISE EXCEPTION 'Reception exceeds remaining ordered quantity for product %', v_item_id
        USING ERRCODE = 'check_violation';
    END IF;

    SELECT section_id INTO v_item_section_id FROM public.catalog_items WHERE id = v_item_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Catalog product not found' USING ERRCODE = 'no_data_found'; END IF;
    v_selected_section_id := nullif(v_item->>'section_id', '')::uuid;
    IF v_selected_section_id IS NOT NULL THEN
      SELECT is_active INTO v_section_active FROM public.sections WHERE id = v_selected_section_id;
      IF NOT FOUND OR v_section_active IS NOT TRUE THEN
        RAISE EXCEPTION 'Reception area is not active' USING ERRCODE = 'check_violation';
      END IF;
      v_item_section_id := v_selected_section_id;
    END IF;

    SELECT section_id, is_active INTO v_location_section_id, v_location_active
    FROM public.locations WHERE id = v_location_id;
    IF NOT FOUND OR v_location_active IS FALSE THEN
      RAISE EXCEPTION 'Storage location not found or inactive' USING ERRCODE = 'check_violation';
    END IF;
    IF v_selected_section_id IS NOT NULL AND v_location_section_id IS DISTINCT FROM v_selected_section_id THEN
      RAISE EXCEPTION 'Storage location does not match selected area' USING ERRCODE = 'check_violation';
    END IF;
    IF v_item_section_id IS NOT NULL AND v_location_section_id IS NOT NULL
       AND v_item_section_id <> v_location_section_id THEN
      RAISE EXCEPTION 'Storage location does not match product section' USING ERRCODE = 'check_violation';
    END IF;
    IF v_selected_section_id IS NOT NULL THEN
      UPDATE public.catalog_items SET section_id = v_selected_section_id WHERE id = v_item_id;
    END IF;

    SELECT * INTO v_existing_batch FROM public.inventory_batches
    WHERE item_id = v_item_id AND batch_number = v_lot_number AND location_id = v_location_id
    FOR UPDATE;
    IF FOUND THEN
      IF v_existing_batch.expiration_date <> v_expiration_date THEN
        RAISE EXCEPTION 'Existing lot has a different expiration date' USING ERRCODE = 'check_violation';
      END IF;
      IF v_existing_batch.supplier_id IS NOT NULL AND v_existing_batch.supplier_id <> v_order.supplier_id THEN
        RAISE EXCEPTION 'Existing lot belongs to a different supplier' USING ERRCODE = 'check_violation';
      END IF;
      IF v_existing_batch.status IN ('rejected', 'expired')
         OR v_existing_batch.clinical_status IN ('rejected', 'expired') THEN
        RAISE EXCEPTION 'Cannot receive into a rejected or expired lot' USING ERRCODE = 'check_violation';
      END IF;
      v_batch_id := v_existing_batch.id;
      IF p_is_approved THEN
        UPDATE public.inventory_batches SET
          initial_quantity = coalesce(initial_quantity, 0) + v_quantity,
          status = 'accepted', clinical_status = 'accepted',
          acceptance_test_status = 'passed', verified_by = v_user_id
        WHERE id = v_batch_id;
      ELSE
        UPDATE public.inventory_batches SET
          initial_quantity = coalesce(initial_quantity, 0) + v_quantity,
          status = 'quarantine', clinical_status = 'quarantine',
          acceptance_test_status = 'pending'
        WHERE id = v_batch_id;
      END IF;
    ELSE
      IF p_is_approved THEN
        INSERT INTO public.inventory_batches (
          item_id, location_id, supplier_id, batch_number, expiration_date,
          current_stock, initial_quantity, status, clinical_status,
          acceptance_test_status, received_by, verified_by, notes
        ) VALUES (
          v_item_id, v_location_id, v_order.supplier_id, v_lot_number, v_expiration_date,
          0, v_quantity, 'accepted', 'accepted', 'passed', v_user_id, v_user_id,
          'Recepcion tecnica factura ' || trim(p_invoice_number)
        ) RETURNING id INTO v_batch_id;
      ELSE
        INSERT INTO public.inventory_batches (
          item_id, location_id, supplier_id, batch_number, expiration_date,
          current_stock, initial_quantity, status, clinical_status,
          acceptance_test_status, received_by, verified_by, notes
        ) VALUES (
          v_item_id, v_location_id, v_order.supplier_id, v_lot_number, v_expiration_date,
          0, v_quantity, 'quarantine', 'quarantine', 'pending', v_user_id, v_user_id,
          'Recepcion tecnica factura ' || trim(p_invoice_number)
        ) RETURNING id INTO v_batch_id;
      END IF;
    END IF;

    INSERT INTO public.stock_movements (batch_id, user_id, movement_type, quantity, reason)
    VALUES (v_batch_id, v_user_id, 'entry', v_quantity,
      'Recepcion tecnica de factura ' || trim(p_invoice_number));

    INSERT INTO public.reception_items (
      technical_reception_id, catalog_item_id, batch_id, quantity_received, unit_price
    ) VALUES (v_reception_id, v_item_id, v_batch_id, v_quantity, v_unit_price);

    UPDATE public.purchase_order_items
    SET quantity_received = coalesce(quantity_received, 0) + v_quantity
    WHERE id = v_order_item.id;
  END LOOP;

  SELECT bool_and(coalesce(quantity_received, 0) >= quantity_requested),
         bool_or(coalesce(quantity_received, 0) > 0)
  INTO v_fully_received, v_has_received
  FROM public.purchase_order_items WHERE purchase_order_id = p_order_id;

  IF v_fully_received THEN
    UPDATE public.purchase_orders SET status = 'completed' WHERE id = p_order_id;
  ELSIF v_has_received THEN
    UPDATE public.purchase_orders SET status = 'partially_received' WHERE id = p_order_id;
  ELSE
    UPDATE public.purchase_orders SET status = 'requested' WHERE id = p_order_id;
  END IF;

  RETURN v_reception_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_register_technical_reception(uuid, text, text, boolean, numeric, boolean, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_register_technical_reception(uuid, text, text, boolean, numeric, boolean, text, jsonb) TO authenticated;

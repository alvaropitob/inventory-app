-- Replace hard-coded role-name gates in privileged SECURITY DEFINER workflows with the canonical permission catalog.

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
     OR NOT public.fn_current_user_has_access_permission('inventory.transfer') THEN
    RAISE EXCEPTION 'Unauthorized inventory transfer' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 OR p_destination_location_id IS NULL THEN
    RAISE EXCEPTION 'Invalid transfer quantity or destination' USING ERRCODE = 'check_violation';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.locations
    WHERE id = p_destination_location_id
      AND is_active = true
      AND (lower(trim(name)) = 'sede norte' OR lower(trim(name)) LIKE 'sede norte %')
  ) THEN
    RAISE EXCEPTION 'Destination must be an active Sede Norte location' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_source FROM public.inventory_batches WHERE id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Source batch not found' USING ERRCODE = 'no_data_found'; END IF;
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

  SELECT * INTO v_target FROM public.inventory_batches
  WHERE item_id = v_source.item_id AND batch_number = v_source.batch_number
    AND location_id = p_destination_location_id FOR UPDATE;
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
  IF v_user_id IS NULL OR NOT public.fn_current_user_has_access_permission('reception.record') THEN
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
     OR NOT public.fn_current_user_has_access_permission('inventory.consume') THEN
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
      AND (b.current_stock > 0 OR coalesce(b.opened_units_remaining, 0) > 0)
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

CREATE OR REPLACE FUNCTION public.fn_consume_fractional_inventory_batch(
  p_batch_id uuid,
  p_units integer,
  p_units_per_package integer,
  p_consumed_by uuid,
  p_reason text,
  p_equipment_name text DEFAULT NULL,
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
  v_opened_units integer;
  v_units_per_package integer;
  v_remaining_open_units integer;
  v_packages_needed integer;
  v_fefo_deviation boolean;
  v_presentation text;
  v_matches text[];
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_consumed_by
     OR NOT public.fn_current_user_has_access_permission('inventory.consume') THEN
    RAISE EXCEPTION 'Unauthorized inventory consumption' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_batch_id IS NULL OR p_units IS NULL OR p_units <= 0
     OR p_units_per_package IS NULL OR p_units_per_package <= 1
     OR nullif(trim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'Invalid fractional consumption data' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_batch
  FROM public.inventory_batches
  WHERE id = p_batch_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inventory batch not found' USING ERRCODE = 'no_data_found'; END IF;

  SELECT commercial_presentation INTO v_presentation
  FROM public.catalog_items
  WHERE id = v_batch.item_id;

  IF nullif(trim(v_presentation), '') IS NOT NULL
     AND lower(trim(v_presentation)) <> 'no aplica' THEN
    IF trim(v_presentation) ~ '^[0-9]+$' THEN
      v_units_per_package := trim(v_presentation)::integer;
    ELSE
      v_matches := regexp_match(v_presentation, '(?:x|por|\*)[[:space:]]*([0-9]+)', 'i');
      IF v_matches IS NOT NULL THEN
        v_units_per_package := v_matches[1]::integer;
      ELSE
        v_matches := regexp_match(
          v_presentation,
          '([0-9]+)[[:space:]]*(determinaciones|det|pruebas?|tests?|unidades?|dosis|tubos?|tiras?)',
          'i'
        );
        IF v_matches IS NOT NULL THEN
          v_units_per_package := v_matches[1]::integer;
        END IF;
      END IF;
    END IF;
  END IF;

  IF v_units_per_package IS NULL OR v_units_per_package <= 1 THEN
    RAISE EXCEPTION 'Catalog presentation does not define a valid fractional package size'
      USING ERRCODE = 'check_violation';
  END IF;
  IF p_units_per_package <> v_units_per_package THEN
    RAISE EXCEPTION 'Package size mismatch: catalog has %, request supplied %',
      v_units_per_package, p_units_per_package
      USING ERRCODE = 'check_violation';
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

  v_opened_units := coalesce(v_batch.opened_units_remaining, 0);
  IF v_opened_units > 0
     AND coalesce(v_batch.opened_units_per_package, 0) <> v_units_per_package THEN
    RAISE EXCEPTION 'Package presentation differs from the package already opened for this batch'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_units > v_opened_units + (v_batch.current_stock * v_units_per_package) THEN
    RAISE EXCEPTION 'Insufficient fractional stock; available: % units',
      v_opened_units + (v_batch.current_stock * v_units_per_package)
      USING ERRCODE = 'check_violation';
  END IF;

  v_packages_needed := greatest(0, ceil(greatest(0, p_units - v_opened_units)::numeric / v_units_per_package)::integer);
  IF v_packages_needed > v_batch.current_stock THEN
    RAISE EXCEPTION 'Insufficient unopened packages' USING ERRCODE = 'check_violation';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.inventory_batches b
    WHERE b.item_id = v_batch.item_id
      AND b.id <> v_batch.id
      AND (b.current_stock > 0 OR coalesce(b.opened_units_remaining, 0) > 0)
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

  IF v_packages_needed > 0 THEN
    PERFORM public.fn_consume_inventory_batch(
      p_batch_id,
      v_packages_needed,
      p_consumed_by,
      '[FRACCIONAL_PACKAGE_OPEN] ' || trim(p_reason) || ' (apertura de ' || v_packages_needed || ' empaque(s); retiro de ' || p_units || ' unidades internas)',
      p_equipment_name,
      true,
      false,
      false,
      p_justification_reason
    );
  END IF;

  v_remaining_open_units := v_opened_units + (v_packages_needed * v_units_per_package) - p_units;
  UPDATE public.inventory_batches
  SET opened_units_remaining = v_remaining_open_units,
      opened_units_per_package = CASE WHEN v_remaining_open_units > 0 THEN v_units_per_package ELSE 0 END,
      opening_date = coalesce(opening_date, now())
  WHERE id = p_batch_id;

  INSERT INTO public.inventory_fractional_movements (
    batch_id, user_id, units_withdrawn, units_per_package, packages_opened, reason, equipment_name
  ) VALUES (
    p_batch_id, p_consumed_by, p_units, v_units_per_package, v_packages_needed,
    CASE WHEN v_fefo_deviation
      THEN '[FEFO DEVIATION] ' || trim(p_justification_reason) || ' | Reason: ' || trim(p_reason)
      ELSE trim(p_reason)
    END,
    nullif(trim(p_equipment_name), '')
  );

  RETURN p_batch_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_receive_inventory_batch(
  p_item_id uuid,
  p_location_id uuid,
  p_supplier_id uuid,
  p_batch_number text,
  p_expiration_date date,
  p_quantity integer,
  p_received_by uuid,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch public.inventory_batches%ROWTYPE;
  v_batch_id uuid;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_received_by
     OR NOT public.fn_current_user_has_access_permission('reception.record') THEN
    RAISE EXCEPTION 'Unauthorized stock receipt' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_item_id IS NULL OR p_location_id IS NULL OR p_batch_number IS NULL
     OR trim(p_batch_number) = '' OR p_expiration_date IS NULL
     OR p_expiration_date < CURRENT_DATE OR p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Invalid stock receipt data' USING ERRCODE = 'check_violation';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    p_item_id::text || ':' || trim(p_batch_number) || ':' || p_location_id::text, 0
  ));

  PERFORM 1 FROM public.catalog_items WHERE id = p_item_id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Catalog item is inactive or missing' USING ERRCODE = 'check_violation'; END IF;
  PERFORM 1 FROM public.locations WHERE id = p_location_id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Storage location is inactive or missing' USING ERRCODE = 'check_violation'; END IF;
  IF p_supplier_id IS NOT NULL THEN
    PERFORM 1 FROM public.suppliers WHERE id = p_supplier_id AND is_active = true;
    IF NOT FOUND THEN RAISE EXCEPTION 'Supplier is inactive or missing' USING ERRCODE = 'check_violation'; END IF;
  END IF;

  SELECT * INTO v_batch
  FROM public.inventory_batches
  WHERE item_id = p_item_id AND batch_number = trim(p_batch_number) AND location_id = p_location_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_batch.expiration_date <> p_expiration_date
       OR v_batch.supplier_id IS DISTINCT FROM p_supplier_id THEN
      RAISE EXCEPTION 'Existing batch metadata does not match this receipt' USING ERRCODE = 'check_violation';
    END IF;
    IF v_batch.status::text IN ('expired', 'rejected')
       OR v_batch.clinical_status::text IN ('expired', 'rejected') THEN
      RAISE EXCEPTION 'Cannot receive stock into an expired or rejected batch' USING ERRCODE = 'check_violation';
    END IF;
    v_batch_id := v_batch.id;
  ELSE
    INSERT INTO public.inventory_batches (
      item_id, location_id, supplier_id, batch_number, expiration_date,
      initial_quantity, current_stock, received_by, notes,
      status, clinical_status, acceptance_test_status
    ) VALUES (
      p_item_id, p_location_id, p_supplier_id, trim(p_batch_number), p_expiration_date,
      p_quantity, 0, p_received_by, p_notes,
      'quarantine', 'quarantine', 'pending'
    ) RETURNING id INTO v_batch_id;
  END IF;

  INSERT INTO public.stock_movements (batch_id, user_id, movement_type, quantity, reason)
  VALUES (v_batch_id, p_received_by, 'entry', p_quantity, coalesce(nullif(trim(p_notes), ''), 'Ingreso de mercancía'));
  RETURN v_batch_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_record_environmental_reading(
  p_location_id uuid,
  p_temperature numeric,
  p_humidity numeric,
  p_reading_type public.reading_type,
  p_is_correction boolean DEFAULT false,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_reading_date date;
  v_start timestamptz;
  v_has_reading boolean;
  v_reading_id uuid;
BEGIN
  IF v_user_id IS NULL OR NOT public.fn_current_user_has_access_permission('environmental.record') THEN
    RAISE EXCEPTION 'Unauthorized environmental reading' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_location_id IS NULL OR p_temperature IS NULL OR p_reading_type IS NULL THEN
    RAISE EXCEPTION 'Location, temperature and reading shift are required' USING ERRCODE = 'check_violation';
  END IF;
  IF p_is_correction AND nullif(trim(p_notes), '') IS NULL THEN
    RAISE EXCEPTION 'Environmental reading corrections require a reason' USING ERRCODE = 'check_violation';
  END IF;

  v_reading_date := timezone('America/Bogota', now())::date;
  v_start := v_reading_date::timestamp AT TIME ZONE 'America/Bogota';
  PERFORM pg_advisory_xact_lock(hashtextextended(
    concat_ws('|', p_location_id::text, v_reading_date::text, p_reading_type::text), 0
  ));

  SELECT EXISTS (
    SELECT 1
    FROM public.environmental_readings
    WHERE location_id = p_location_id
      AND reading_type = p_reading_type
      AND created_at >= v_start
      AND created_at < v_start + interval '1 day'
  ) INTO v_has_reading;

  IF v_has_reading AND NOT p_is_correction THEN
    RAISE EXCEPTION 'A reading already exists for this location, date and shift' USING ERRCODE = 'unique_violation';
  END IF;
  IF p_is_correction AND NOT v_has_reading THEN
    RAISE EXCEPTION 'There is no reading to correct for this location, date and shift' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.environmental_readings (
    location_id, user_id, temperature, humidity, reading_type, notes
  ) VALUES (
    p_location_id,
    v_user_id,
    p_temperature,
    p_humidity,
    p_reading_type,
    CASE WHEN p_is_correction
      THEN '[CORRECCIÓN] ' || trim(p_notes)
      ELSE nullif(trim(p_notes), '')
    END
  ) RETURNING id INTO v_reading_id;

  RETURN v_reading_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_create_purchase_order_with_items(
  p_order_number text,
  p_supplier_id uuid,
  p_created_by uuid,
  p_expected_delivery_date date,
  p_notes text,
  p_total_estimated_value numeric,
  p_items jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_item jsonb;
  v_item_id uuid;
  v_quantity numeric;
  v_unit_price numeric;
  v_total_value numeric := 0;
  v_item_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_created_by
     OR NOT public.fn_current_user_has_access_permission('orders.manage') THEN
    RAISE EXCEPTION 'Unauthorized order creator' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_order_number IS NULL OR trim(p_order_number) = '' THEN
    RAISE EXCEPTION 'Order number is required' USING ERRCODE = 'check_violation';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_items) < 1 OR jsonb_array_length(p_items) > 500 THEN
    RAISE EXCEPTION 'Invalid order item list' USING ERRCODE = 'check_violation';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = p_supplier_id AND is_active = true) THEN
    RAISE EXCEPTION 'Supplier is inactive or missing' USING ERRCODE = 'check_violation';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    IF jsonb_typeof(v_item) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'Invalid order item' USING ERRCODE = 'check_violation';
    END IF;
    v_item_id := nullif(v_item->>'item_id', '')::uuid;
    v_quantity := nullif(v_item->>'quantity_requested', '')::numeric;
    v_unit_price := nullif(v_item->>'estimated_unit_price', '')::numeric;
    IF v_item_id IS NULL OR v_quantity IS NULL OR v_quantity <> trunc(v_quantity)
       OR v_quantity < 1 OR v_quantity > 2147483647
       OR v_unit_price IS NULL OR v_unit_price < 0
       OR v_unit_price::text IN ('NaN', 'Infinity', '-Infinity') THEN
      RAISE EXCEPTION 'Invalid order item quantity or price' USING ERRCODE = 'check_violation';
    END IF;
    IF v_item_id = ANY(v_item_ids) THEN
      RAISE EXCEPTION 'Duplicate product in order' USING ERRCODE = 'check_violation';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.catalog_items
      WHERE id = v_item_id AND supplier_id = p_supplier_id AND is_active = true
    ) THEN
      RAISE EXCEPTION 'Order product is inactive or does not belong to the selected supplier' USING ERRCODE = 'check_violation';
    END IF;
    v_item_ids := array_append(v_item_ids, v_item_id);
    v_total_value := v_total_value + v_quantity * v_unit_price;
  END LOOP;

  INSERT INTO public.purchase_orders (
    order_number, supplier_id, created_by, status,
    expected_delivery_date, notes, total_estimated_value
  ) VALUES (
    trim(p_order_number), p_supplier_id, p_created_by, 'draft',
    p_expected_delivery_date, p_notes, v_total_value
  ) RETURNING id INTO v_order_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.purchase_order_items (
      purchase_order_id, item_id, quantity_requested, estimated_unit_price
    ) VALUES (
      v_order_id,
      (v_item->>'item_id')::uuid,
      (v_item->>'quantity_requested')::integer,
      (v_item->>'estimated_unit_price')::numeric
    );
  END LOOP;

  RETURN v_order_id;
END;
$$;

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
     OR NOT public.fn_current_user_has_access_permission('inventory.dispose') THEN
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

CREATE OR REPLACE FUNCTION public.fn_update_catalog_item_sanitary_registration(
  p_item_id uuid,
  p_registration text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.fn_current_user_has_access_permission('catalog.manage') THEN
    RAISE EXCEPTION 'Unauthorized catalog registration update' USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE public.catalog_items
  SET sanitary_registration = nullif(trim(p_registration), '')
  WHERE id = p_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Catalog item not found' USING ERRCODE = 'no_data_found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_add_maintenance_record(
  p_equipment_id uuid,
  p_type text,
  p_execution_date date,
  p_scheduled_date date,
  p_performed_by uuid,
  p_provider_name text,
  p_description text,
  p_result text,
  p_next_due_date date
)
RETURNS SETOF public.maintenance_records
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_role text;
  v_record public.maintenance_records;
BEGIN
  SELECT public.fn_get_user_role() INTO v_role;
  IF NOT public.fn_current_user_has_access_permission('equipment.maintain') THEN
    RAISE EXCEPTION 'No tienes permisos para registrar mantenimiento.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_performed_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'El responsable debe ser el usuario autenticado.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_type NOT IN ('preventive', 'corrective', 'calibration') THEN
    RAISE EXCEPTION 'Tipo de mantenimiento no válido.' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.maintenance_records (
    equipment_id, type, execution_date, scheduled_date, performed_by,
    provider_name, description, result, next_due_date
  ) VALUES (
    p_equipment_id, p_type, p_execution_date, p_scheduled_date, p_performed_by,
    p_provider_name, p_description, p_result, p_next_due_date
  ) RETURNING * INTO v_record;

  IF p_type = 'preventive' THEN
    UPDATE public.equipments
    SET last_preventive_maintenance = p_execution_date,
        next_preventive_maintenance = p_next_due_date
    WHERE id = p_equipment_id;
  ELSIF p_type = 'calibration' THEN
    UPDATE public.equipments
    SET last_calibration = p_execution_date,
        next_calibration = p_next_due_date
    WHERE id = p_equipment_id;
  END IF;

  RETURN NEXT v_record;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_report_safety_incident(
  p_batch_id uuid,
  p_incident_type text,
  p_description text,
  p_action_taken text,
  p_reported_by uuid
)
RETURNS SETOF public.safety_incidents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_role text;
  v_input public.safety_incidents;
  v_incident public.safety_incidents;
  v_updated integer;
BEGIN
  IF auth.uid() IS NULL OR p_reported_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'El reportante debe ser el usuario autenticado.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_role := public.fn_get_user_role();
  IF NOT public.fn_current_user_has_access_permission('safety.incident.submit') THEN
    RAISE EXCEPTION 'No tienes permisos para reportar incidentes de seguridad.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_batch_id IS NULL
     OR p_incident_type IS NULL
     OR p_incident_type NOT IN ('recall', 'adverse_event', 'quality_failure', 'other')
     OR nullif(trim(p_description), '') IS NULL THEN
    RAISE EXCEPTION 'Completa un lote, tipo y descripción válidos.' USING ERRCODE = 'check_violation';
  END IF;

  -- Populate the table composite so the database casts incident_type correctly
  -- whether that column is text or a project enum.
  v_input := pg_catalog.jsonb_populate_record(
    NULL::public.safety_incidents,
    pg_catalog.jsonb_build_object(
      'batch_id', p_batch_id,
      'incident_type', p_incident_type,
      'description', p_description,
      'action_taken', p_action_taken,
      'reported_by', p_reported_by
    )
  );

  INSERT INTO public.safety_incidents (
    batch_id, incident_type, description, action_taken, reported_by
  ) VALUES (
    v_input.batch_id, v_input.incident_type, v_input.description,
    v_input.action_taken, v_input.reported_by
  ) RETURNING * INTO v_incident;

  IF p_incident_type IN ('recall', 'quality_failure') THEN
    UPDATE public.inventory_batches
    SET status = 'rejected',
        clinical_status = 'rejected'
    WHERE id = p_batch_id;

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated = 0 THEN
      RAISE EXCEPTION 'No se encontró el lote indicado.' USING ERRCODE = 'no_data_found';
    END IF;
  END IF;

  RETURN NEXT v_incident;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_reject_batch_for_safety_incident(
  p_batch_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_role text;
  v_updated integer;
BEGIN
  IF auth.uid() IS NULL OR p_batch_id IS NULL THEN
    RAISE EXCEPTION 'Usuario y lote son obligatorios.' USING ERRCODE = '22023';
  END IF;

  v_role := public.fn_get_user_role();
  IF NOT public.fn_current_user_has_access_permission('safety.incident.submit') THEN
    RAISE EXCEPTION 'No tienes permisos para reportar este incidente.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.safety_incidents si
    WHERE si.batch_id = p_batch_id
      AND si.reported_by = auth.uid()
      AND si.incident_type::text IN ('recall', 'quality_failure')
  ) THEN
    RAISE EXCEPTION 'No existe un incidente de retiro o falla de calidad reportado por este usuario para el lote.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE public.inventory_batches
  SET status = 'rejected',
      clinical_status = 'rejected'
  WHERE id = p_batch_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RAISE EXCEPTION 'No se encontró el lote indicado.' USING ERRCODE = 'no_data_found';
  END IF;
END;
$$;

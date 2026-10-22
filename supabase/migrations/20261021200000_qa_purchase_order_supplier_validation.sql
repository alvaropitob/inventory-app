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
     OR public.fn_get_user_role() NOT IN ('admin', 'supervisor') THEN
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

REVOKE ALL ON FUNCTION public.fn_create_purchase_order_with_items(text, uuid, uuid, date, text, numeric, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_create_purchase_order_with_items(text, uuid, uuid, date, text, numeric, jsonb) TO authenticated;

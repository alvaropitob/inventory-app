-- Revoke the overly broad policies introduced by the original PO migration.
-- Authorization is tied to the same public.users -> public.roles source used by the app.
DROP POLICY IF EXISTS "Users can view all purchase orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Users can create purchase orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Users can update purchase orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Users can delete draft purchase orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Users can view all purchase order items" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Users can create purchase order items" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Users can update purchase order items" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Users can delete purchase order items" ON public.purchase_order_items;

-- A supplier lot can be split across storage locations. The previous unique
-- key prevented the partial-transfer workflow from creating its destination lot.
ALTER TABLE public.inventory_batches
  DROP CONSTRAINT IF EXISTS unique_batch_per_item;
ALTER TABLE public.inventory_batches
  ADD CONSTRAINT unique_batch_per_item_location UNIQUE (item_id, batch_number, location_id);

-- Create purchase orders and all their lines as a single database transaction.
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
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_created_by THEN
    RAISE EXCEPTION 'Unauthorized order creator' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_items) < 1 OR jsonb_array_length(p_items) > 500 THEN
    RAISE EXCEPTION 'Invalid order item list' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.purchase_orders (
    order_number, supplier_id, created_by, status,
    expected_delivery_date, notes, total_estimated_value
  ) VALUES (
    p_order_number, p_supplier_id, p_created_by, 'draft',
    p_expected_delivery_date, p_notes, p_total_estimated_value
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

CREATE POLICY purchase_orders_select_staff
  ON public.purchase_orders FOR SELECT TO authenticated
  USING (public.fn_get_user_role() IN ('admin', 'supervisor', 'operator', 'auditor'));

CREATE POLICY purchase_orders_insert_authorized
  ON public.purchase_orders FOR INSERT TO authenticated
  WITH CHECK (
    public.fn_get_user_role() IN ('admin', 'supervisor')
    AND created_by = auth.uid()
    AND status = 'draft'
  );

CREATE POLICY purchase_orders_update_authorized
  ON public.purchase_orders FOR UPDATE TO authenticated
  USING (public.fn_get_user_role() IN ('admin', 'supervisor'))
  WITH CHECK (public.fn_get_user_role() IN ('admin', 'supervisor'));

CREATE POLICY purchase_orders_delete_own_draft
  ON public.purchase_orders FOR DELETE TO authenticated
  USING (public.fn_get_user_role() IN ('admin', 'supervisor') AND status = 'draft' AND created_by = auth.uid());

CREATE OR REPLACE FUNCTION public.fn_validate_purchase_order_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;
  IF NOT (
    (OLD.status = 'draft' AND NEW.status IN ('requested', 'cancelled')) OR
    (OLD.status = 'requested' AND NEW.status IN ('partially_received', 'completed', 'cancelled')) OR
    (OLD.status = 'partially_received' AND NEW.status IN ('completed', 'cancelled'))
  ) THEN
    RAISE EXCEPTION 'Invalid purchase order transition: % -> %', OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_purchase_order_transition ON public.purchase_orders;
CREATE TRIGGER trg_validate_purchase_order_transition
  BEFORE UPDATE OF status ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.fn_validate_purchase_order_transition();

-- Extend database generated audit evidence to mutable operational tables.
DROP TRIGGER IF EXISTS trg_audit_equipment ON public.equipment;
CREATE TRIGGER trg_audit_equipment
  AFTER INSERT OR UPDATE ON public.equipment
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

DROP TRIGGER IF EXISTS trg_audit_environmental_readings ON public.environmental_readings;
CREATE TRIGGER trg_audit_environmental_readings
  AFTER INSERT ON public.environmental_readings
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

CREATE POLICY purchase_order_items_select_staff
  ON public.purchase_order_items FOR SELECT TO authenticated
  USING (public.fn_get_user_role() IN ('admin', 'supervisor', 'operator', 'auditor'));

CREATE POLICY purchase_order_items_insert_authorized
  ON public.purchase_order_items FOR INSERT TO authenticated
  WITH CHECK (
    public.fn_get_user_role() IN ('admin', 'supervisor')
    AND EXISTS (
      SELECT 1 FROM public.purchase_orders po
      WHERE po.id = purchase_order_id AND po.status = 'draft'
    )
  );

CREATE POLICY purchase_order_items_update_authorized
  ON public.purchase_order_items FOR UPDATE TO authenticated
  USING (
    public.fn_get_user_role() IN ('admin', 'supervisor')
    AND EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = purchase_order_id AND po.status = 'draft')
  )
  WITH CHECK (
    public.fn_get_user_role() IN ('admin', 'supervisor')
    AND EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = purchase_order_id AND po.status = 'draft')
  );

CREATE POLICY purchase_order_items_delete_authorized
  ON public.purchase_order_items FOR DELETE TO authenticated
  USING (
    public.fn_get_user_role() IN ('admin', 'supervisor')
    AND EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = purchase_order_id AND po.status = 'draft')
  );

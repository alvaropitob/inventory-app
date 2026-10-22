-- Recepción manual atómica: lote, movimiento de entrada y auditoría.
-- Ejecutar en Supabase SQL Editor con permisos de administrador.
BEGIN;

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
     OR public.fn_get_user_role() NOT IN ('admin', 'supervisor', 'operator') THEN
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

REVOKE ALL ON FUNCTION public.fn_receive_inventory_batch(uuid, uuid, uuid, text, date, integer, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_receive_inventory_batch(uuid, uuid, uuid, text, date, integer, uuid, text) TO authenticated;

DROP TRIGGER IF EXISTS trg_audit_inventory_batches ON public.inventory_batches;
CREATE TRIGGER trg_audit_inventory_batches
  AFTER INSERT OR UPDATE ON public.inventory_batches
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

DROP TRIGGER IF EXISTS trg_audit_stock_movements ON public.stock_movements;
CREATE TRIGGER trg_audit_stock_movements
  AFTER INSERT ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

COMMIT;

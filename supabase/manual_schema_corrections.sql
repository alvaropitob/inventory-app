-- Correcciones de esquema para los flujos actualizados de inventario.
-- Ejecutar en Supabase SQL Editor con permisos de administrador de la base.
-- El script es repetible. Presupone el esquema base existente de la aplicacion
-- (catalog_items, locations, sections, inventory_batches, stock_movements,
-- users, supplier_evaluations, equipments y maintenance_records).

BEGIN;

-- Clasificacion y ficha tecnica del catalogo.
ALTER TABLE public.catalog_items
  ADD COLUMN IF NOT EXISTS product_type text NOT NULL DEFAULT 'reactivo',
  ADD COLUMN IF NOT EXISTS series text,
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS product_description text,
  ADD COLUMN IF NOT EXISTS active_ingredient text,
  ADD COLUMN IF NOT EXISTS dosage_form text,
  ADD COLUMN IF NOT EXISTS concentration text,
  ADD COLUMN IF NOT EXISTS commercial_presentation text,
  ADD COLUMN IF NOT EXISTS shelf_life text;

ALTER TYPE public.risk_classification ADD VALUE IF NOT EXISTS 'not_applicable';

ALTER TABLE public.catalog_items
  DROP CONSTRAINT IF EXISTS catalog_items_product_type_check;
ALTER TABLE public.catalog_items
  ADD CONSTRAINT catalog_items_product_type_check
  CHECK (product_type IN ('medicamento', 'dispositivo_medico', 'reactivo', 'insumo'));

-- Campos usados por recepcion tecnica, evaluacion de proveedores y equipos.
ALTER TABLE IF EXISTS public.technical_receptions
  ADD COLUMN IF NOT EXISTS invoice_number text;

ALTER TABLE IF EXISTS public.supplier_evaluations
  ADD COLUMN IF NOT EXISTS supplier_email text,
  ADD COLUMN IF NOT EXISTS evaluator_name text,
  ADD COLUMN IF NOT EXISTS evaluator_role text,
  ADD COLUMN IF NOT EXISTS answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS applicable_questions integer,
  ADD COLUMN IF NOT EXISTS points_possible integer,
  ADD COLUMN IF NOT EXISTS percentage_score numeric(5,2),
  ADD COLUMN IF NOT EXISTS rating text;

ALTER TABLE IF EXISTS public.maintenance_records
  ADD COLUMN IF NOT EXISTS scheduled_date date,
  ADD COLUMN IF NOT EXISTS provider_name text;

ALTER TABLE IF EXISTS public.equipments
  ADD COLUMN IF NOT EXISTS inventory_number text,
  ADD COLUMN IF NOT EXISTS section_id uuid REFERENCES public.sections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS measurement_range text,
  ADD COLUMN IF NOT EXISTS sanitary_registration text,
  ADD COLUMN IF NOT EXISTS risk_classification text,
  ADD COLUMN IF NOT EXISTS calibration_frequency text,
  ADD COLUMN IF NOT EXISTS maintenance_frequency text,
  ADD COLUMN IF NOT EXISTS responsible text;

-- El frontend usa public.equipments (plural). Mantener la auditoria en esa
-- tabla y retirar el trigger antiguo si quedo ligado a public.equipment.
DO $$
BEGIN
  IF to_regclass('public.equipments') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_audit_equipment ON public.equipments';
    EXECUTE 'CREATE TRIGGER trg_audit_equipment AFTER INSERT OR UPDATE ON public.equipments FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log()';
  END IF;
  IF to_regclass('public.equipment') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_audit_equipment ON public.equipment';
  END IF;
END;
$$;

-- Evaluacion mensual de alertas. El porcentaje se registra manualmente porque
-- la regla de calculo no esta definida en los requisitos disponibles.
CREATE TABLE IF NOT EXISTS public.safety_alert_monthly_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_month date NOT NULL UNIQUE,
  verified_device_reagent_alerts integer NOT NULL DEFAULT 0 CHECK (verified_device_reagent_alerts >= 0),
  verified_device_reagent_security_reports integer NOT NULL DEFAULT 0 CHECK (verified_device_reagent_security_reports >= 0),
  verified_medicine_biological_reports integer NOT NULL DEFAULT 0 CHECK (verified_medicine_biological_reports >= 0),
  managed_reactivovigilance integer NOT NULL DEFAULT 0 CHECK (managed_reactivovigilance >= 0),
  managed_tecnovigilance integer NOT NULL DEFAULT 0 CHECK (managed_tecnovigilance >= 0),
  managed_pharmacovigilance integer NOT NULL DEFAULT 0 CHECK (managed_pharmacovigilance >= 0),
  vigilance_percentage numeric(5,2) NOT NULL DEFAULT 0 CHECK (vigilance_percentage BETWEEN 0 AND 100),
  notes text,
  recorded_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT safety_alert_month_first_day CHECK (EXTRACT(DAY FROM period_month) = 1)
);

ALTER TABLE public.safety_alert_monthly_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS safety_alert_monthly_reports_select_staff ON public.safety_alert_monthly_reports;
CREATE POLICY safety_alert_monthly_reports_select_staff
  ON public.safety_alert_monthly_reports FOR SELECT TO authenticated
  USING (public.fn_get_user_role() IN ('admin', 'supervisor', 'operator', 'auditor'));
DROP POLICY IF EXISTS safety_alert_monthly_reports_insert_managers ON public.safety_alert_monthly_reports;
CREATE POLICY safety_alert_monthly_reports_insert_managers
  ON public.safety_alert_monthly_reports FOR INSERT TO authenticated
  WITH CHECK (public.fn_get_user_role() IN ('admin', 'supervisor'));
DROP POLICY IF EXISTS safety_alert_monthly_reports_update_managers ON public.safety_alert_monthly_reports;
CREATE POLICY safety_alert_monthly_reports_update_managers
  ON public.safety_alert_monthly_reports FOR UPDATE TO authenticated
  USING (public.fn_get_user_role() IN ('admin', 'supervisor'))
  WITH CHECK (public.fn_get_user_role() IN ('admin', 'supervisor'));
GRANT SELECT, INSERT, UPDATE ON public.safety_alert_monthly_reports TO authenticated;

-- La misma referencia de lote puede existir en varias ubicaciones.
ALTER TABLE public.inventory_batches
  DROP CONSTRAINT IF EXISTS unique_batch_per_item;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.inventory_batches'::regclass
      AND conname = 'unique_batch_per_item_location'
  ) THEN
    ALTER TABLE public.inventory_batches
      ADD CONSTRAINT unique_batch_per_item_location UNIQUE (item_id, batch_number, location_id);
  END IF;
END;
$$;

-- Transferir stock y registrar salida/entrada en una unica transaccion.
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
  IF v_destination_name IS NULL THEN RAISE EXCEPTION 'Destination location not found' USING ERRCODE = 'no_data_found'; END IF;
  v_reason := concat_ws(' ', 'Traslado de', p_quantity, 'unidades desde', coalesce(v_origin_name, 'ubicacion origen'),
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
      concat('Lote destino creado por traslado desde ', coalesce(v_origin_name, 'ubicacion origen'))
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

COMMIT;

-- Replace legacy role-name RLS with the same permission catalog used by the
-- server actions and privileged database functions.

CREATE OR REPLACE FUNCTION public.fn_reset_access_policies(p_table_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_policy record;
BEGIN
  IF p_table_name !~ '^[a-z_][a-z0-9_]*$' OR to_regclass(format('public.%I', p_table_name)) IS NULL THEN
    RAISE EXCEPTION 'Tabla de control de acceso no válida: %', p_table_name USING ERRCODE = 'invalid_parameter_value';
  END IF;
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', p_table_name);
  FOR v_policy IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = p_table_name LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', v_policy.policyname, p_table_name);
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_reset_access_policies(text) FROM PUBLIC, anon, authenticated;

-- Master data
SELECT public.fn_reset_access_policies('catalog_items');
SELECT public.fn_reset_access_policies('categories');
SELECT public.fn_reset_access_policies('sections');
SELECT public.fn_reset_access_policies('locations');
SELECT public.fn_reset_access_policies('suppliers');
SELECT public.fn_reset_access_policies('services');
SELECT public.fn_reset_access_policies('settings');
SELECT public.fn_reset_access_policies('equipments');
SELECT public.fn_reset_access_policies('maintenance_records');
SELECT public.fn_reset_access_policies('supplier_evaluations');
SELECT public.fn_reset_access_policies('purchase_orders');
SELECT public.fn_reset_access_policies('purchase_order_items');

-- Operational records. Mutations are performed only by permission-checked RPCs
-- or dedicated server actions; direct writes are denied unless explicitly listed.
SELECT public.fn_reset_access_policies('inventory_batches');
SELECT public.fn_reset_access_policies('stock_movements');
SELECT public.fn_reset_access_policies('inventory_fractional_movements');
SELECT public.fn_reset_access_policies('environmental_readings');
SELECT public.fn_reset_access_policies('safety_incidents');
SELECT public.fn_reset_access_policies('safety_alert_monthly_reports');
SELECT public.fn_reset_access_policies('quality_verifications');
SELECT public.fn_reset_access_policies('audit_logs');

-- User and role records are readable only for self-service and administrators.
SELECT public.fn_reset_access_policies('users');
SELECT public.fn_reset_access_policies('roles');

REVOKE ALL ON public.catalog_items, public.categories, public.sections, public.locations,
  public.suppliers, public.services, public.settings, public.equipments,
  public.maintenance_records, public.supplier_evaluations, public.purchase_orders,
  public.purchase_order_items, public.inventory_batches, public.stock_movements,
  public.inventory_fractional_movements, public.environmental_readings,
  public.safety_incidents, public.safety_alert_monthly_reports,
  public.quality_verifications, public.audit_logs, public.users, public.roles
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.catalog_items, public.categories, public.sections, public.locations,
  public.suppliers, public.services, public.settings, public.equipments,
  public.maintenance_records, public.supplier_evaluations, public.purchase_orders,
  public.purchase_order_items, public.inventory_batches, public.stock_movements,
  public.inventory_fractional_movements, public.environmental_readings,
  public.safety_incidents, public.safety_alert_monthly_reports,
  public.quality_verifications, public.audit_logs, public.users, public.roles
TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.catalog_items, public.categories, public.sections,
  public.locations, public.suppliers, public.services, public.settings, public.equipments,
  public.supplier_evaluations, public.purchase_orders,
  public.purchase_order_items, public.safety_alert_monthly_reports,
  public.quality_verifications TO authenticated;

CREATE POLICY catalog_items_select ON public.catalog_items FOR SELECT TO authenticated
  USING (public.fn_current_user_has_access_permission('inventory.view'));
CREATE POLICY catalog_items_insert ON public.catalog_items FOR INSERT TO authenticated
  WITH CHECK (public.fn_current_user_has_access_permission('catalog.manage'));
CREATE POLICY catalog_items_update ON public.catalog_items FOR UPDATE TO authenticated
  USING (public.fn_current_user_has_access_permission('catalog.manage'))
  WITH CHECK (public.fn_current_user_has_access_permission('catalog.manage'));
CREATE POLICY catalog_items_delete ON public.catalog_items FOR DELETE TO authenticated
  USING (public.fn_current_user_has_access_permission('catalog.delete'));

CREATE POLICY categories_select ON public.categories FOR SELECT TO authenticated
  USING (public.fn_current_user_has_access_permission('inventory.view') OR public.fn_current_user_has_access_permission('configuration.manage'));
CREATE POLICY categories_manage ON public.categories FOR ALL TO authenticated
  USING (public.fn_current_user_has_access_permission('configuration.manage'))
  WITH CHECK (public.fn_current_user_has_access_permission('configuration.manage'));

CREATE POLICY sections_select ON public.sections FOR SELECT TO authenticated
  USING (public.fn_current_user_has_access_permission('inventory.view') OR public.fn_current_user_has_access_permission('configuration.manage'));
CREATE POLICY sections_manage ON public.sections FOR ALL TO authenticated
  USING (public.fn_current_user_has_access_permission('configuration.manage'))
  WITH CHECK (public.fn_current_user_has_access_permission('configuration.manage'));

CREATE POLICY locations_select ON public.locations FOR SELECT TO authenticated
  USING (public.fn_current_user_has_access_permission('inventory.view') OR public.fn_current_user_has_access_permission('configuration.manage'));
CREATE POLICY locations_manage ON public.locations FOR ALL TO authenticated
  USING (public.fn_current_user_has_access_permission('configuration.manage'))
  WITH CHECK (public.fn_current_user_has_access_permission('configuration.manage'));

CREATE POLICY suppliers_select ON public.suppliers FOR SELECT TO authenticated
  USING (public.fn_current_user_has_access_permission('suppliers.view') OR public.fn_current_user_has_access_permission('suppliers.manage'));
CREATE POLICY suppliers_manage ON public.suppliers FOR ALL TO authenticated
  USING (public.fn_current_user_has_access_permission('suppliers.manage'))
  WITH CHECK (public.fn_current_user_has_access_permission('suppliers.manage'));

CREATE POLICY services_select ON public.services FOR SELECT TO authenticated
  USING (public.fn_current_user_has_access_permission('inventory.view') OR public.fn_current_user_has_access_permission('configuration.manage'));
CREATE POLICY services_manage ON public.services FOR ALL TO authenticated
  USING (public.fn_current_user_has_access_permission('configuration.manage'))
  WITH CHECK (public.fn_current_user_has_access_permission('configuration.manage'));
CREATE POLICY settings_manage ON public.settings FOR ALL TO authenticated
  USING (public.fn_current_user_has_access_permission('configuration.manage'))
  WITH CHECK (public.fn_current_user_has_access_permission('configuration.manage'));

CREATE POLICY equipments_select ON public.equipments FOR SELECT TO authenticated
  USING (public.fn_current_user_has_access_permission('equipment.view') OR public.fn_current_user_has_access_permission('equipment.manage'));
CREATE POLICY equipments_insert ON public.equipments FOR INSERT TO authenticated
  WITH CHECK (public.fn_current_user_has_access_permission('equipment.manage'));
CREATE POLICY equipments_update ON public.equipments FOR UPDATE TO authenticated
  USING (public.fn_current_user_has_access_permission('equipment.manage'))
  WITH CHECK (public.fn_current_user_has_access_permission('equipment.manage'));
CREATE POLICY equipments_delete ON public.equipments FOR DELETE TO authenticated
  USING (public.fn_current_user_has_access_permission('equipment.manage'));

CREATE POLICY maintenance_records_select ON public.maintenance_records FOR SELECT TO authenticated
  USING (public.fn_current_user_has_access_permission('equipment.view') OR public.fn_current_user_has_access_permission('equipment.maintain'));
CREATE POLICY supplier_evaluations_select ON public.supplier_evaluations FOR SELECT TO authenticated
  USING (public.fn_current_user_has_access_permission('suppliers.view') OR public.fn_current_user_has_access_permission('suppliers.evaluate'));
CREATE POLICY supplier_evaluations_insert ON public.supplier_evaluations FOR INSERT TO authenticated
  WITH CHECK (public.fn_current_user_has_access_permission('suppliers.evaluate'));

CREATE POLICY purchase_orders_select ON public.purchase_orders FOR SELECT TO authenticated
  USING (public.fn_current_user_has_access_permission('orders.view'));
CREATE POLICY purchase_orders_insert ON public.purchase_orders FOR INSERT TO authenticated
  WITH CHECK (public.fn_current_user_has_access_permission('orders.manage') AND created_by = auth.uid() AND status = 'draft');
CREATE POLICY purchase_orders_update ON public.purchase_orders FOR UPDATE TO authenticated
  USING (public.fn_current_user_has_access_permission('orders.manage'))
  WITH CHECK (public.fn_current_user_has_access_permission('orders.manage'));
CREATE POLICY purchase_orders_delete ON public.purchase_orders FOR DELETE TO authenticated
  USING (public.fn_current_user_has_access_permission('orders.manage') AND status = 'draft' AND created_by = auth.uid());

CREATE POLICY purchase_order_items_select ON public.purchase_order_items FOR SELECT TO authenticated
  USING (public.fn_current_user_has_access_permission('orders.view'));
CREATE POLICY purchase_order_items_insert ON public.purchase_order_items FOR INSERT TO authenticated
  WITH CHECK (public.fn_current_user_has_access_permission('orders.manage') AND EXISTS (
    SELECT 1 FROM public.purchase_orders po WHERE po.id = purchase_order_id AND po.status = 'draft'));
CREATE POLICY purchase_order_items_update ON public.purchase_order_items FOR UPDATE TO authenticated
  USING (public.fn_current_user_has_access_permission('orders.manage') AND EXISTS (
    SELECT 1 FROM public.purchase_orders po WHERE po.id = purchase_order_id AND po.status = 'draft'))
  WITH CHECK (public.fn_current_user_has_access_permission('orders.manage') AND EXISTS (
    SELECT 1 FROM public.purchase_orders po WHERE po.id = purchase_order_id AND po.status = 'draft'));
CREATE POLICY purchase_order_items_delete ON public.purchase_order_items FOR DELETE TO authenticated
  USING (public.fn_current_user_has_access_permission('orders.manage') AND EXISTS (
    SELECT 1 FROM public.purchase_orders po WHERE po.id = purchase_order_id AND po.status = 'draft'));

CREATE POLICY inventory_batches_select ON public.inventory_batches FOR SELECT TO authenticated
  USING (public.fn_current_user_has_access_permission('inventory.view'));
CREATE POLICY stock_movements_select ON public.stock_movements FOR SELECT TO authenticated
  USING (public.fn_current_user_has_access_permission('inventory.view'));
CREATE POLICY fractional_movements_select ON public.inventory_fractional_movements FOR SELECT TO authenticated
  USING (public.fn_current_user_has_access_permission('inventory.view'));
CREATE POLICY environmental_readings_select ON public.environmental_readings FOR SELECT TO authenticated
  USING (public.fn_current_user_has_access_permission('monitoring.view'));
CREATE POLICY safety_incidents_select ON public.safety_incidents FOR SELECT TO authenticated
  USING (public.fn_current_user_has_access_permission('safety.view'));
CREATE POLICY safety_monthly_reports_select ON public.safety_alert_monthly_reports FOR SELECT TO authenticated
  USING (public.fn_current_user_has_access_permission('safety.view') OR public.fn_current_user_has_access_permission('safety.monthly.manage'));
CREATE POLICY safety_monthly_reports_insert ON public.safety_alert_monthly_reports FOR INSERT TO authenticated
  WITH CHECK (public.fn_current_user_has_access_permission('safety.monthly.manage'));
CREATE POLICY safety_monthly_reports_update ON public.safety_alert_monthly_reports FOR UPDATE TO authenticated
  USING (public.fn_current_user_has_access_permission('safety.monthly.manage'))
  WITH CHECK (public.fn_current_user_has_access_permission('safety.monthly.manage'));
CREATE POLICY quality_verifications_select ON public.quality_verifications FOR SELECT TO authenticated
  USING (public.fn_current_user_has_access_permission('quality.view') OR public.fn_current_user_has_access_permission('quality.verify'));
CREATE POLICY quality_verifications_insert ON public.quality_verifications FOR INSERT TO authenticated
  WITH CHECK (public.fn_current_user_has_access_permission('quality.verify') AND verified_by = auth.uid());
CREATE POLICY audit_logs_select ON public.audit_logs FOR SELECT TO authenticated
  USING (public.fn_current_user_has_access_permission('audit.logs.view'));

CREATE POLICY users_select_self_or_manager ON public.users FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.fn_current_user_has_access_permission('users.manage'));
CREATE POLICY roles_select_authorized ON public.roles FOR SELECT TO authenticated
  USING (public.fn_current_user_has_access_permission('dashboard.view')
    OR public.fn_current_user_has_access_permission('roles.manage')
    OR public.fn_current_user_has_access_permission('users.manage'));

CREATE OR REPLACE FUNCTION public.fn_get_audit_user_directory()
RETURNS TABLE(id uuid, full_name text, username text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT u.id, u.full_name, u.username
  FROM public.users u
  WHERE public.fn_current_user_has_access_permission('audit.logs.view')
$$;
REVOKE ALL ON FUNCTION public.fn_get_audit_user_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_get_audit_user_directory() TO authenticated;

-- All critical event histories are read-only through the public API. Database
-- triggers and SECURITY DEFINER workflows write using their trusted owner.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.inventory_batches, public.stock_movements,
  public.inventory_fractional_movements, public.environmental_readings,
  public.safety_incidents, public.audit_logs, public.users, public.roles
FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.inventory_batches, public.stock_movements,
  public.inventory_fractional_movements, public.environmental_readings,
  public.safety_incidents, public.audit_logs, public.users, public.roles
TO authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.safety_alert_monthly_reports,
  public.quality_verifications FROM PUBLIC, anon;
REVOKE UPDATE, DELETE, TRUNCATE ON public.safety_alert_monthly_reports,
  public.quality_verifications FROM authenticated;

NOTIFY pgrst, 'reload schema';

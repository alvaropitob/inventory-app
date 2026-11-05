-- Remove legacy RLS policies that bypass the canonical users/roles model.
-- Run after 20261104120000_consistent_user_access.sql.

-- Legacy JWT role claims can be stale and are not the source of truth.
DROP POLICY IF EXISTS "Allow manage for admin and supervisor" ON public.catalog_items;
DROP POLICY IF EXISTS "Allow read for all users" ON public.catalog_items;
DROP POLICY IF EXISTS "Allow all for admins" ON public.categories;
DROP POLICY IF EXISTS "Allow read for authenticated users" ON public.categories;
DROP POLICY IF EXISTS categories_select_authenticated ON public.categories;
DROP POLICY IF EXISTS categories_manage_admin ON public.categories;
CREATE POLICY categories_select_authenticated
  ON public.categories FOR SELECT TO authenticated
  USING (public.fn_get_user_role() IN ('admin', 'supervisor', 'operator', 'auditor'));
CREATE POLICY categories_manage_admin
  ON public.categories FOR ALL TO authenticated
  USING (public.fn_get_user_role() = 'admin')
  WITH CHECK (public.fn_get_user_role() = 'admin');
DROP POLICY IF EXISTS "Allow all for admins" ON public.locations;
DROP POLICY IF EXISTS "Allow read for authenticated users" ON public.locations;
DROP POLICY IF EXISTS "Allow all for admins" ON public.sections;
DROP POLICY IF EXISTS "Allow read for authenticated users" ON public.sections;
DROP POLICY IF EXISTS "Allow all for admins" ON public.suppliers;
DROP POLICY IF EXISTS "Allow read for authenticated users" ON public.suppliers;

-- Prevent users from assigning or deleting their own roles. Role changes go through
-- fn_update_user_access(), which checks the active canonical admin role.
DROP POLICY IF EXISTS "Usuarios pueden asignarse roles" ON public.user_roles;
DROP POLICY IF EXISTS "Usuarios pueden eliminar sus propios roles" ON public.user_roles;
DROP POLICY IF EXISTS "Usuarios pueden ver sus propios roles" ON public.user_roles;
DROP POLICY IF EXISTS user_roles_select_own ON public.user_roles;
CREATE POLICY user_roles_select_own
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM anon, authenticated;
GRANT SELECT ON public.user_roles TO authenticated;

-- The application uses public.users as its canonical profile. The legacy profiles
-- table contains duplicate role fields and is not safe to expose or edit from clients.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone logged in" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
REVOKE ALL ON public.profiles FROM PUBLIC, anon, authenticated;

-- Restrict formerly public metadata/administrative tables to signed-in users.
DROP POLICY IF EXISTS "Permisos son visibles públicamente" ON public.permissions;
DROP POLICY IF EXISTS permissions_select_authenticated ON public.permissions;
CREATE POLICY permissions_select_authenticated
  ON public.permissions FOR SELECT TO authenticated USING (true);
REVOKE ALL ON public.permissions FROM PUBLIC, anon;
GRANT SELECT ON public.permissions TO authenticated;

DROP POLICY IF EXISTS "Permisos de roles son visibles públicamente" ON public.role_permissions;
DROP POLICY IF EXISTS role_permissions_select_authenticated ON public.role_permissions;
CREATE POLICY role_permissions_select_authenticated
  ON public.role_permissions FOR SELECT TO authenticated USING (true);
REVOKE ALL ON public.role_permissions FROM PUBLIC, anon;
GRANT SELECT ON public.role_permissions TO authenticated;

-- Equipment registration remains admin/supervisor only. Operators can record
-- maintenance through fn_add_maintenance_record(), which updates dates atomically.
DROP POLICY IF EXISTS "Acceso total equipos" ON public.equipments;
DROP POLICY IF EXISTS equipments_select_authenticated ON public.equipments;
DROP POLICY IF EXISTS equipments_insert_managers ON public.equipments;
DROP POLICY IF EXISTS equipments_update_managers ON public.equipments;
DROP POLICY IF EXISTS equipments_delete_managers ON public.equipments;
CREATE POLICY equipments_select_authenticated
  ON public.equipments FOR SELECT TO authenticated
  USING (public.fn_get_user_role() IN ('admin', 'supervisor', 'operator', 'auditor'));
DROP POLICY IF EXISTS equipments_insert_managers ON public.equipments;
CREATE POLICY equipments_insert_managers
  ON public.equipments FOR INSERT TO authenticated
  WITH CHECK (public.fn_get_user_role() IN ('admin', 'supervisor'));
DROP POLICY IF EXISTS equipments_update_managers ON public.equipments;
CREATE POLICY equipments_update_managers
  ON public.equipments FOR UPDATE TO authenticated
  USING (public.fn_get_user_role() IN ('admin', 'supervisor'))
  WITH CHECK (public.fn_get_user_role() IN ('admin', 'supervisor'));
DROP POLICY IF EXISTS equipments_delete_managers ON public.equipments;
CREATE POLICY equipments_delete_managers
  ON public.equipments FOR DELETE TO authenticated
  USING (public.fn_get_user_role() = 'admin');
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipments TO authenticated;

DROP POLICY IF EXISTS "Acceso total mantenimiento" ON public.maintenance_records;
DROP POLICY IF EXISTS maintenance_records_select_authenticated ON public.maintenance_records;
DROP POLICY IF EXISTS maintenance_records_insert_staff ON public.maintenance_records;
DROP POLICY IF EXISTS maintenance_records_update_managers ON public.maintenance_records;
DROP POLICY IF EXISTS maintenance_records_delete_admin ON public.maintenance_records;
CREATE POLICY maintenance_records_select_authenticated
  ON public.maintenance_records FOR SELECT TO authenticated
  USING (public.fn_get_user_role() IN ('admin', 'supervisor', 'operator', 'auditor'));
DROP POLICY IF EXISTS maintenance_records_insert_staff ON public.maintenance_records;
CREATE POLICY maintenance_records_insert_staff
  ON public.maintenance_records FOR INSERT TO authenticated
  WITH CHECK (public.fn_get_user_role() IN ('admin', 'supervisor', 'operator'));
DROP POLICY IF EXISTS maintenance_records_update_managers ON public.maintenance_records;
CREATE POLICY maintenance_records_update_managers
  ON public.maintenance_records FOR UPDATE TO authenticated
  USING (public.fn_get_user_role() IN ('admin', 'supervisor'))
  WITH CHECK (public.fn_get_user_role() IN ('admin', 'supervisor'));
DROP POLICY IF EXISTS maintenance_records_delete_admin ON public.maintenance_records;
CREATE POLICY maintenance_records_delete_admin
  ON public.maintenance_records FOR DELETE TO authenticated
  USING (public.fn_get_user_role() = 'admin');
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_records TO authenticated;

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
  IF v_role NOT IN ('admin', 'supervisor', 'operator') THEN
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
REVOKE ALL ON FUNCTION public.fn_add_maintenance_record(uuid, text, date, date, uuid, text, text, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_add_maintenance_record(uuid, text, date, date, uuid, text, text, text, date) TO authenticated;

-- This legacy reception detail table is written by trusted database workflows;
-- the browser must not insert, update, or delete rows directly.
DROP POLICY IF EXISTS "Todo en items_recepcion" ON public.reception_items;
ALTER TABLE public.reception_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reception_items FROM PUBLIC, anon, authenticated;

-- Replace misleading public/service policies with canonical manager-only access.
DROP POLICY IF EXISTS "Solo admins pueden modificar servicios" ON public.services;
DROP POLICY IF EXISTS "Servicios son visibles para todos" ON public.services;
DROP POLICY IF EXISTS services_select_authenticated ON public.services;
DROP POLICY IF EXISTS services_manage_admin ON public.services;
CREATE POLICY services_select_authenticated
  ON public.services FOR SELECT TO authenticated USING (true);
CREATE POLICY services_manage_admin
  ON public.services FOR ALL TO authenticated
  USING (public.fn_get_user_role() = 'admin')
  WITH CHECK (public.fn_get_user_role() = 'admin');
REVOKE ALL ON public.services FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated;

DROP POLICY IF EXISTS "Auth users can update settings" ON public.settings;
DROP POLICY IF EXISTS "Public can read settings" ON public.settings;
DROP POLICY IF EXISTS settings_select_admin ON public.settings;
DROP POLICY IF EXISTS settings_manage_admin ON public.settings;
CREATE POLICY settings_select_admin
  ON public.settings FOR SELECT TO authenticated
  USING (public.fn_get_user_role() = 'admin');
CREATE POLICY settings_manage_admin
  ON public.settings FOR ALL TO authenticated
  USING (public.fn_get_user_role() = 'admin')
  WITH CHECK (public.fn_get_user_role() = 'admin');
REVOKE ALL ON public.settings FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settings TO authenticated;

-- Supplier evaluations contain staff/evaluator data and are writable only by
-- the roles allowed by the application workflow.
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.supplier_evaluations;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.supplier_evaluations;
DROP POLICY IF EXISTS supplier_evaluations_select_staff ON public.supplier_evaluations;
DROP POLICY IF EXISTS supplier_evaluations_insert_managers ON public.supplier_evaluations;
CREATE POLICY supplier_evaluations_select_staff
  ON public.supplier_evaluations FOR SELECT TO authenticated
  USING (public.fn_get_user_role() IN ('admin', 'supervisor', 'operator', 'auditor'));
CREATE POLICY supplier_evaluations_insert_managers
  ON public.supplier_evaluations FOR INSERT TO authenticated
  WITH CHECK (public.fn_get_user_role() IN ('admin', 'supervisor'));
REVOKE ALL ON public.supplier_evaluations FROM PUBLIC, anon;
GRANT SELECT, INSERT ON public.supplier_evaluations TO authenticated;

-- Enforce RLS on the legacy singular table too; its existing role-specific
-- policies from the report remain in place.
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;

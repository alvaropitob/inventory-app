-- Dynamic application RBAC. Existing role names and assignments are retained;
-- permissions are seeded to match the current TypeScript matrix before cutover.

ALTER TABLE public.roles
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.roles
SET code = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '_', 'g'))
WHERE code IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS roles_code_unique_idx ON public.roles (code);

CREATE TABLE IF NOT EXISTS public.access_permissions (
  code text PRIMARY KEY,
  module text NOT NULL,
  action text NOT NULL,
  label text NOT NULL,
  description text NOT NULL DEFAULT '',
  is_sensitive boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.access_role_permissions (
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE RESTRICT,
  permission_code text NOT NULL REFERENCES public.access_permissions(code) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_code)
);

CREATE TABLE IF NOT EXISTS public.access_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  subject_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  role_id uuid REFERENCES public.roles(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('role_created', 'role_updated', 'role_archived', 'user_access_updated')),
  before_state jsonb,
  after_state jsonb,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS access_audit_events_created_at_idx
  ON public.access_audit_events (created_at DESC);
CREATE INDEX IF NOT EXISTS access_role_permissions_code_idx
  ON public.access_role_permissions (permission_code, role_id);

CREATE OR REPLACE FUNCTION public.fn_reject_access_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  RAISE EXCEPTION 'Los eventos de acceso son inmutables.' USING ERRCODE = 'insufficient_privilege';
END;
$$;
REVOKE ALL ON FUNCTION public.fn_reject_access_audit_mutation() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_access_audit_events_append_only ON public.access_audit_events;
CREATE TRIGGER trg_access_audit_events_append_only
  BEFORE UPDATE OR DELETE ON public.access_audit_events
  FOR EACH ROW EXECUTE FUNCTION public.fn_reject_access_audit_mutation();

ALTER TABLE public.access_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS access_permissions_read_authenticated ON public.access_permissions;
CREATE POLICY access_permissions_read_authenticated ON public.access_permissions
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS access_role_permissions_read_authenticated ON public.access_role_permissions;
CREATE POLICY access_role_permissions_read_authenticated ON public.access_role_permissions
  FOR SELECT TO authenticated USING (true);
REVOKE ALL ON public.access_permissions, public.access_role_permissions, public.access_audit_events FROM PUBLIC, anon;
GRANT SELECT ON public.access_permissions, public.access_role_permissions TO authenticated;
GRANT SELECT ON public.access_audit_events TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_user_has_access_permission(p_user_id uuid, p_permission_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    JOIN public.user_roles ur ON ur.user_id = u.id
    JOIN public.roles r ON r.id = ur.role_id
    JOIN public.access_role_permissions arp ON arp.role_id = r.id
    WHERE u.id = p_user_id
      AND u.is_active IS TRUE
      AND r.is_active IS TRUE
      AND arp.permission_code = p_permission_code
  )
$$;
REVOKE ALL ON FUNCTION public.fn_user_has_access_permission(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.fn_current_user_has_access_permission(p_permission_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$ SELECT auth.uid() IS NOT NULL AND public.fn_user_has_access_permission(auth.uid(), p_permission_code) $$;
REVOKE ALL ON FUNCTION public.fn_current_user_has_access_permission(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_current_user_has_access_permission(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_current_user_access_permissions()
RETURNS TABLE(permission_code text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT DISTINCT arp.permission_code
  FROM public.user_roles ur
  JOIN public.users u ON u.id = ur.user_id AND u.is_active IS TRUE
  JOIN public.roles r ON r.id = ur.role_id AND r.is_active IS TRUE
  JOIN public.access_role_permissions arp ON arp.role_id = r.id
  WHERE ur.user_id = auth.uid()
$$;
REVOKE ALL ON FUNCTION public.fn_current_user_access_permissions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_current_user_access_permissions() TO authenticated;

-- Canonical permission catalog mirrors current behavior to avoid a privilege
-- change when the application switches from its static matrix.
INSERT INTO public.access_permissions (code, module, action, label, is_sensitive) VALUES
  ('dashboard.view','dashboard','view','Ver panel',false),
  ('inventory.view','inventory','view','Consultar inventario',false),
  ('orders.view','orders','view','Consultar pedidos',false),
  ('reception.view','reception','view','Consultar recepciones',false),
  ('suppliers.view','suppliers','view','Consultar proveedores',false),
  ('safety.view','safety','view','Consultar alertas e incidentes',false),
  ('monitoring.view','monitoring','view','Consultar monitoreo ambiental',false),
  ('equipment.view','equipment','view','Consultar equipos',false),
  ('reports.view','reports','view','Consultar reportes',false),
  ('quality.view','quality','view','Consultar calidad',false),
  ('configuration.manage','configuration','manage','Administrar configuración',true),
  ('catalog.manage','catalog','manage','Crear y editar catálogo',true),
  ('catalog.delete','catalog','delete','Retirar elementos del catálogo',true),
  ('catalog.toggle','catalog','toggle','Activar o desactivar elementos',true),
  ('inventory.consume','inventory','consume','Registrar consumo',false),
  ('inventory.dispose','inventory','dispose','Dar de baja y disponer inventario',true),
  ('inventory.transfer','inventory','transfer','Trasladar inventario',false),
  ('orders.manage','orders','manage','Administrar pedidos',true),
  ('reception.record','reception','record','Registrar recepción técnica',false),
  ('quality.verify','quality','verify','Verificar calidad',true),
  ('suppliers.manage','suppliers','manage','Administrar proveedores',true),
  ('suppliers.evaluate','suppliers','evaluate','Evaluar proveedores',true),
  ('equipment.manage','equipment','manage','Administrar equipos',true),
  ('equipment.maintain','equipment','maintain','Registrar mantenimiento',false),
  ('environmental.record','monitoring','record','Registrar lectura ambiental',false),
  ('environmental.range.manage','monitoring','manage','Administrar rangos ambientales',true),
  ('safety.incident.submit','safety','submit','Reportar incidentes',false),
  ('safety.monthly.manage','safety','manage','Administrar reportes mensuales',true),
  ('audit.logs.view','audit','view','Consultar auditoría',false),
  ('users.manage','users','manage','Administrar usuarios',true),
  ('roles.manage','roles','manage','Administrar roles y permisos',true)
ON CONFLICT (code) DO UPDATE SET
  module = EXCLUDED.module, action = EXCLUDED.action,
  label = EXCLUDED.label, is_sensitive = EXCLUDED.is_sensitive;

-- Seed only the built-in role matrix. Custom roles start with no permissions.
INSERT INTO public.access_role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM public.roles r
CROSS JOIN public.access_permissions p
WHERE r.name = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO public.access_role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM public.roles r
CROSS JOIN public.access_permissions p
WHERE r.name = 'supervisor'
  AND p.code IN (
    'dashboard.view','inventory.view','orders.view','reception.view','suppliers.view','safety.view',
    'monitoring.view','equipment.view','reports.view','quality.view','catalog.manage','catalog.toggle',
    'inventory.dispose','inventory.transfer','orders.manage','quality.verify','suppliers.evaluate',
    'equipment.manage','equipment.maintain','safety.incident.submit','safety.monthly.manage','audit.logs.view'
  )
ON CONFLICT DO NOTHING;

INSERT INTO public.access_role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM public.roles r
CROSS JOIN public.access_permissions p
WHERE r.name = 'operator'
  AND p.code IN (
    'dashboard.view','inventory.view','orders.view','reception.view','suppliers.view','safety.view',
    'monitoring.view','equipment.view','reports.view','quality.view','inventory.consume','inventory.transfer',
    'reception.record','equipment.maintain','environmental.record','safety.incident.submit'
  )
ON CONFLICT DO NOTHING;

INSERT INTO public.access_role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM public.roles r
CROSS JOIN public.access_permissions p
WHERE r.name = 'auditor'
  AND p.code IN (
    'dashboard.view','inventory.view','orders.view','reception.view','suppliers.view','safety.view',
    'monitoring.view','equipment.view','reports.view','quality.view','audit.logs.view'
  )
ON CONFLICT DO NOTHING;

UPDATE public.roles SET is_system = true, updated_at = now()
WHERE name IN ('admin', 'supervisor', 'operator', 'auditor');

CREATE OR REPLACE FUNCTION public.fn_admin_save_access_role(
  p_role_id uuid,
  p_name text,
  p_description text,
  p_permission_codes text[],
  p_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_role_id uuid;
  v_before jsonb;
  v_after jsonb;
BEGIN
  IF auth.uid() IS NULL OR public.fn_get_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'No tienes permiso para administrar roles.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF nullif(trim(p_name), '') IS NULL OR length(trim(p_name)) > 80
     OR nullif(trim(p_reason), '') IS NULL OR length(trim(p_reason)) < 8 THEN
    RAISE EXCEPTION 'Nombre y motivo (mínimo 8 caracteres) son obligatorios.' USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(coalesce(p_permission_codes, ARRAY[]::text[])) c WHERE NOT EXISTS (
    SELECT 1 FROM public.access_permissions ap WHERE ap.code = c
  )) THEN
    RAISE EXCEPTION 'La selección contiene permisos desconocidos.' USING ERRCODE = 'check_violation';
  END IF;
  IF NOT ('roles.manage' = ANY(coalesce(p_permission_codes, ARRAY[]::text[]))) THEN
    RAISE EXCEPTION 'El rol debe conservar el permiso para administrar roles.' USING ERRCODE = 'check_violation';
  END IF;
  IF trim(p_name) <> 'admin' AND 'users.manage' = ANY(coalesce(p_permission_codes, ARRAY[]::text[])) THEN
    RAISE EXCEPTION 'La administración de usuarios se reserva al perfil administrador.' USING ERRCODE = 'check_violation';
  END IF;

  IF p_role_id IS NULL THEN
    INSERT INTO public.roles (name, description, is_active, code, is_system, updated_at)
    VALUES (trim(p_name), nullif(trim(p_description), ''), true,
      lower(regexp_replace(trim(p_name), '[^a-zA-Z0-9]+', '_', 'g')) || '_' || substr(gen_random_uuid()::text, 1, 8),
      false, now())
    RETURNING id INTO v_role_id;
    v_before := NULL;
  ELSE
    PERFORM 1 FROM public.roles WHERE id = p_role_id FOR UPDATE;
    SELECT jsonb_build_object('name', r.name, 'description', r.description, 'is_active', r.is_active,
      'permissions', coalesce((SELECT array_agg(arp.permission_code ORDER BY arp.permission_code)
        FROM public.access_role_permissions arp WHERE arp.role_id = r.id), ARRAY[]::text[]))
    INTO v_before FROM public.roles r WHERE r.id = p_role_id;
    IF v_before IS NULL THEN RAISE EXCEPTION 'No se encontró el rol.' USING ERRCODE = 'no_data_found'; END IF;
    IF EXISTS (SELECT 1 FROM public.roles WHERE id = p_role_id AND is_system AND name <> trim(p_name)) THEN
      RAISE EXCEPTION 'El nombre de un rol del sistema no se puede cambiar.' USING ERRCODE = 'check_violation';
    END IF;
    IF EXISTS (SELECT 1 FROM public.roles WHERE id = p_role_id AND is_system AND name = 'admin')
       AND NOT ('users.manage' = ANY(coalesce(p_permission_codes, ARRAY[]::text[]))) THEN
      RAISE EXCEPTION 'El perfil administrador debe conservar la administración de usuarios.' USING ERRCODE = 'check_violation';
    END IF;
    UPDATE public.roles SET name = trim(p_name), description = nullif(trim(p_description), ''), updated_at = now()
    WHERE id = p_role_id RETURNING id INTO v_role_id;
    DELETE FROM public.access_role_permissions WHERE role_id = v_role_id;
  END IF;

  INSERT INTO public.access_role_permissions (role_id, permission_code)
  SELECT v_role_id, c FROM unnest(coalesce(p_permission_codes, ARRAY[]::text[])) c
  ON CONFLICT DO NOTHING;
  SELECT jsonb_build_object('name', r.name, 'description', r.description, 'is_active', r.is_active,
    'permissions', coalesce((SELECT array_agg(arp.permission_code ORDER BY arp.permission_code)
      FROM public.access_role_permissions arp WHERE arp.role_id = r.id), ARRAY[]::text[]))
  INTO v_after FROM public.roles r WHERE r.id = v_role_id;

  INSERT INTO public.access_audit_events(actor_user_id, role_id, event_type, before_state, after_state, reason)
  VALUES (auth.uid(), v_role_id, CASE WHEN p_role_id IS NULL THEN 'role_created' ELSE 'role_updated' END,
    v_before, v_after, trim(p_reason));
  RETURN v_role_id;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_admin_save_access_role(uuid, text, text, text[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_save_access_role(uuid, text, text, text[], text) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_admin_set_user_access(
  p_target_user_id uuid,
  p_role_ids uuid[],
  p_primary_role_id uuid,
  p_is_active boolean,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_before jsonb;
  v_after jsonb;
  v_old_manager boolean;
  v_new_manager boolean;
  v_role_ids uuid[] := coalesce(p_role_ids, ARRAY[]::uuid[]);
BEGIN
  IF auth.uid() IS NULL OR public.fn_get_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'No tienes permiso para administrar usuarios.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_target_user_id IS NULL OR p_primary_role_id IS NULL OR p_is_active IS NULL
     OR nullif(trim(p_reason), '') IS NULL OR length(trim(p_reason)) < 8 THEN
    RAISE EXCEPTION 'Usuario, rol principal, estado y motivo (mínimo 8 caracteres) son obligatorios.' USING ERRCODE = 'check_violation';
  END IF;
  IF NOT p_primary_role_id = ANY(v_role_ids) THEN
    RAISE EXCEPTION 'El rol principal debe estar entre los roles asignados.' USING ERRCODE = 'check_violation';
  END IF;
  IF cardinality(v_role_ids) = 0 OR EXISTS (
    SELECT 1 FROM unnest(v_role_ids) x LEFT JOIN public.roles r ON r.id = x
    WHERE r.id IS NULL OR r.is_active IS NOT TRUE
  ) THEN
    RAISE EXCEPTION 'Asigna al menos un rol activo válido.' USING ERRCODE = 'check_violation';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('access-control-administration', 0));
  PERFORM 1 FROM public.users WHERE id = p_target_user_id FOR UPDATE;
  SELECT jsonb_build_object('is_active', u.is_active, 'role_ids',
    coalesce((SELECT array_agg(ur.role_id ORDER BY ur.role_id) FROM public.user_roles ur WHERE ur.user_id = u.id), ARRAY[]::uuid[]),
    'primary_role_id', u.role_id)
  INTO v_before FROM public.users u WHERE u.id = p_target_user_id;
  IF v_before IS NULL THEN RAISE EXCEPTION 'No se encontró el usuario.' USING ERRCODE = 'no_data_found'; END IF;
  IF p_target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'No puedes modificar tu propio acceso desde esta pantalla.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_old_manager := public.fn_user_has_access_permission(p_target_user_id, 'users.manage');
  v_new_manager := p_is_active AND EXISTS (
    SELECT 1 FROM public.access_role_permissions arp JOIN public.roles r ON r.id = arp.role_id AND r.is_active
    WHERE r.id = ANY(v_role_ids) AND arp.permission_code = 'users.manage'
  );
  IF v_old_manager AND NOT v_new_manager AND NOT EXISTS (
    SELECT 1 FROM public.users u WHERE u.id <> p_target_user_id AND u.is_active
      AND public.fn_user_has_access_permission(u.id, 'users.manage')
  ) THEN
    RAISE EXCEPTION 'No se puede retirar el acceso al último administrador de usuarios.' USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.users SET role_id = p_primary_role_id, is_active = p_is_active WHERE id = p_target_user_id;
  DELETE FROM public.user_roles WHERE user_id = p_target_user_id;
  INSERT INTO public.user_roles(user_id, role_id, is_primary, updated_at)
  SELECT p_target_user_id, x, x = p_primary_role_id, now() FROM unnest(v_role_ids) x;
  SELECT jsonb_build_object('is_active', p_is_active, 'role_ids', v_role_ids, 'primary_role_id', p_primary_role_id)
  INTO v_after;
  INSERT INTO public.access_audit_events(actor_user_id, subject_user_id, event_type, before_state, after_state, reason)
  VALUES (auth.uid(), p_target_user_id, 'user_access_updated', v_before, v_after, trim(p_reason));
END;
$$;
REVOKE ALL ON FUNCTION public.fn_admin_set_user_access(uuid, uuid[], uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_set_user_access(uuid, uuid[], uuid, boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_admin_archive_access_role(p_role_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_role public.roles%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR public.fn_get_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'No tienes permiso para administrar roles.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF nullif(trim(p_reason), '') IS NULL OR length(trim(p_reason)) < 8 THEN
    RAISE EXCEPTION 'Indica un motivo de al menos 8 caracteres.' USING ERRCODE = 'check_violation';
  END IF;
  SELECT * INTO v_role FROM public.roles WHERE id = p_role_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No se encontró el rol.' USING ERRCODE = 'no_data_found'; END IF;
  IF v_role.is_system THEN RAISE EXCEPTION 'Los roles del sistema no se pueden archivar.' USING ERRCODE = 'check_violation'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role_id = p_role_id) THEN
    RAISE EXCEPTION 'Reasigna a los usuarios antes de archivar este rol.' USING ERRCODE = 'check_violation';
  END IF;
  UPDATE public.roles SET is_active = false, updated_at = now() WHERE id = p_role_id;
  INSERT INTO public.access_audit_events(actor_user_id, role_id, event_type, before_state, after_state, reason)
  VALUES (auth.uid(), p_role_id, 'role_archived', to_jsonb(v_role),
    jsonb_build_object('is_active', false), trim(p_reason));
END;
$$;
REVOKE ALL ON FUNCTION public.fn_admin_archive_access_role(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_archive_access_role(uuid, text) TO authenticated;

-- Keep profile-role updates compatible with the old administrative form while
-- delegating authorization and last-manager protection to the new permission model.
CREATE OR REPLACE FUNCTION public.fn_update_user_access(
  p_target_user_id uuid, p_new_role_id uuid, p_new_is_active boolean
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.fn_get_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'No tienes permisos para administrar accesos.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  PERFORM public.fn_admin_set_user_access(p_target_user_id, ARRAY[p_new_role_id], p_new_role_id,
    p_new_is_active, 'Actualización desde la gestión de usuarios');
END;
$$;
REVOKE ALL ON FUNCTION public.fn_update_user_access(uuid, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_update_user_access(uuid, uuid, boolean) TO authenticated;

-- The audit stream is append-only for authenticated clients.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.access_audit_events FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS access_audit_events_read_authorized ON public.access_audit_events;
CREATE POLICY access_audit_events_read_authorized ON public.access_audit_events
  FOR SELECT TO authenticated USING (public.fn_current_user_has_access_permission('audit.logs.view'));
DROP POLICY IF EXISTS user_roles_select_admin_or_own ON public.user_roles;
DROP POLICY IF EXISTS user_roles_select_own ON public.user_roles;
CREATE POLICY user_roles_select_admin_or_own ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.fn_current_user_has_access_permission('users.manage'));

-- Replace role-name checks on the principal CRUD tables with permission checks.
DROP POLICY IF EXISTS categories_select_authenticated ON public.categories;
CREATE POLICY categories_select_authenticated ON public.categories FOR SELECT TO authenticated
  USING (public.fn_current_user_has_access_permission('inventory.view'));
DROP POLICY IF EXISTS categories_manage_admin ON public.categories;
CREATE POLICY categories_manage_admin ON public.categories FOR ALL TO authenticated
  USING (public.fn_current_user_has_access_permission('configuration.manage'))
  WITH CHECK (public.fn_current_user_has_access_permission('configuration.manage'));

DROP POLICY IF EXISTS locations_select_staff ON public.locations;
CREATE POLICY locations_select_staff ON public.locations FOR SELECT TO authenticated
  USING (public.fn_current_user_has_access_permission('inventory.view'));
DROP POLICY IF EXISTS locations_manage_admin ON public.locations;
CREATE POLICY locations_manage_admin ON public.locations FOR ALL TO authenticated
  USING (public.fn_current_user_has_access_permission('configuration.manage'))
  WITH CHECK (public.fn_current_user_has_access_permission('configuration.manage'));
DROP POLICY IF EXISTS sections_select_staff ON public.sections;
CREATE POLICY sections_select_staff ON public.sections FOR SELECT TO authenticated
  USING (public.fn_current_user_has_access_permission('inventory.view'));
DROP POLICY IF EXISTS sections_manage_admin ON public.sections;
CREATE POLICY sections_manage_admin ON public.sections FOR ALL TO authenticated
  USING (public.fn_current_user_has_access_permission('configuration.manage'))
  WITH CHECK (public.fn_current_user_has_access_permission('configuration.manage'));
DROP POLICY IF EXISTS suppliers_select_staff ON public.suppliers;
CREATE POLICY suppliers_select_staff ON public.suppliers FOR SELECT TO authenticated
  USING (public.fn_current_user_has_access_permission('suppliers.view'));
DROP POLICY IF EXISTS suppliers_manage_admin ON public.suppliers;
CREATE POLICY suppliers_manage_admin ON public.suppliers FOR ALL TO authenticated
  USING (public.fn_current_user_has_access_permission('suppliers.manage'))
  WITH CHECK (public.fn_current_user_has_access_permission('suppliers.manage'));

DROP POLICY IF EXISTS equipments_select_authenticated ON public.equipments;
CREATE POLICY equipments_select_authenticated ON public.equipments FOR SELECT TO authenticated
  USING (public.fn_current_user_has_access_permission('equipment.view'));
DROP POLICY IF EXISTS equipments_insert_managers ON public.equipments;
CREATE POLICY equipments_insert_managers ON public.equipments FOR INSERT TO authenticated
  WITH CHECK (public.fn_current_user_has_access_permission('equipment.manage'));
DROP POLICY IF EXISTS equipments_update_managers ON public.equipments;
CREATE POLICY equipments_update_managers ON public.equipments FOR UPDATE TO authenticated
  USING (public.fn_current_user_has_access_permission('equipment.manage'))
  WITH CHECK (public.fn_current_user_has_access_permission('equipment.manage'));
DROP POLICY IF EXISTS equipments_delete_admin ON public.equipments;
CREATE POLICY equipments_delete_admin ON public.equipments FOR DELETE TO authenticated
  USING (public.fn_current_user_has_access_permission('equipment.manage'));

DROP POLICY IF EXISTS maintenance_records_select_authenticated ON public.maintenance_records;
CREATE POLICY maintenance_records_select_authenticated ON public.maintenance_records FOR SELECT TO authenticated
  USING (public.fn_current_user_has_access_permission('equipment.view'));
DROP POLICY IF EXISTS maintenance_records_insert_staff ON public.maintenance_records;
CREATE POLICY maintenance_records_insert_staff ON public.maintenance_records FOR INSERT TO authenticated
  WITH CHECK (public.fn_current_user_has_access_permission('equipment.maintain'));
DROP POLICY IF EXISTS maintenance_records_update_managers ON public.maintenance_records;
CREATE POLICY maintenance_records_update_managers ON public.maintenance_records FOR UPDATE TO authenticated
  USING (public.fn_current_user_has_access_permission('equipment.manage'))
  WITH CHECK (public.fn_current_user_has_access_permission('equipment.manage'));
DROP POLICY IF EXISTS maintenance_records_delete_admin ON public.maintenance_records;
CREATE POLICY maintenance_records_delete_admin ON public.maintenance_records FOR DELETE TO authenticated
  USING (public.fn_current_user_has_access_permission('equipment.manage'));

DROP POLICY IF EXISTS purchase_orders_select_staff ON public.purchase_orders;
CREATE POLICY purchase_orders_select_staff ON public.purchase_orders FOR SELECT TO authenticated
  USING (public.fn_current_user_has_access_permission('orders.view'));
DROP POLICY IF EXISTS purchase_orders_insert_authorized ON public.purchase_orders;
CREATE POLICY purchase_orders_insert_authorized ON public.purchase_orders FOR INSERT TO authenticated
  WITH CHECK (public.fn_current_user_has_access_permission('orders.manage') AND created_by = auth.uid() AND status = 'draft');
DROP POLICY IF EXISTS purchase_orders_update_authorized ON public.purchase_orders;
CREATE POLICY purchase_orders_update_authorized ON public.purchase_orders FOR UPDATE TO authenticated
  USING (public.fn_current_user_has_access_permission('orders.manage'))
  WITH CHECK (public.fn_current_user_has_access_permission('orders.manage'));
DROP POLICY IF EXISTS purchase_orders_delete_own_draft ON public.purchase_orders;
CREATE POLICY purchase_orders_delete_own_draft ON public.purchase_orders FOR DELETE TO authenticated
  USING (public.fn_current_user_has_access_permission('orders.manage') AND status = 'draft' AND created_by = auth.uid());
DROP POLICY IF EXISTS purchase_order_items_select_staff ON public.purchase_order_items;
CREATE POLICY purchase_order_items_select_staff ON public.purchase_order_items FOR SELECT TO authenticated
  USING (public.fn_current_user_has_access_permission('orders.view'));
DROP POLICY IF EXISTS purchase_order_items_insert_authorized ON public.purchase_order_items;
CREATE POLICY purchase_order_items_insert_authorized ON public.purchase_order_items FOR INSERT TO authenticated
  WITH CHECK (public.fn_current_user_has_access_permission('orders.manage') AND EXISTS (
    SELECT 1 FROM public.purchase_orders po WHERE po.id = purchase_order_id AND po.status = 'draft'));
DROP POLICY IF EXISTS purchase_order_items_update_authorized ON public.purchase_order_items;
CREATE POLICY purchase_order_items_update_authorized ON public.purchase_order_items FOR UPDATE TO authenticated
  USING (public.fn_current_user_has_access_permission('orders.manage') AND EXISTS (
    SELECT 1 FROM public.purchase_orders po WHERE po.id = purchase_order_id AND po.status = 'draft'))
  WITH CHECK (public.fn_current_user_has_access_permission('orders.manage') AND EXISTS (
    SELECT 1 FROM public.purchase_orders po WHERE po.id = purchase_order_id AND po.status = 'draft'));
DROP POLICY IF EXISTS purchase_order_items_delete_authorized ON public.purchase_order_items;
CREATE POLICY purchase_order_items_delete_authorized ON public.purchase_order_items FOR DELETE TO authenticated
  USING (public.fn_current_user_has_access_permission('orders.manage') AND EXISTS (
    SELECT 1 FROM public.purchase_orders po WHERE po.id = purchase_order_id AND po.status = 'draft'));

DROP POLICY IF EXISTS catalog_items_select_access ON public.catalog_items;
CREATE POLICY catalog_items_select_access ON public.catalog_items FOR SELECT TO authenticated
  USING (public.fn_current_user_has_access_permission('inventory.view'));
DROP POLICY IF EXISTS catalog_items_insert_access ON public.catalog_items;
CREATE POLICY catalog_items_insert_access ON public.catalog_items FOR INSERT TO authenticated
  WITH CHECK (public.fn_current_user_has_access_permission('catalog.manage'));
DROP POLICY IF EXISTS catalog_items_update_access ON public.catalog_items;
CREATE POLICY catalog_items_update_access ON public.catalog_items FOR UPDATE TO authenticated
  USING (public.fn_current_user_has_access_permission('catalog.manage'))
  WITH CHECK (public.fn_current_user_has_access_permission('catalog.manage'));
DROP POLICY IF EXISTS catalog_items_delete_access ON public.catalog_items;
CREATE POLICY catalog_items_delete_access ON public.catalog_items FOR DELETE TO authenticated
  USING (public.fn_current_user_has_access_permission('catalog.delete'));

DROP POLICY IF EXISTS supplier_evaluations_select_staff ON public.supplier_evaluations;
CREATE POLICY supplier_evaluations_select_staff ON public.supplier_evaluations FOR SELECT TO authenticated
  USING (public.fn_current_user_has_access_permission('suppliers.view'));
DROP POLICY IF EXISTS supplier_evaluations_insert_managers ON public.supplier_evaluations;
CREATE POLICY supplier_evaluations_insert_managers ON public.supplier_evaluations FOR INSERT TO authenticated
  WITH CHECK (public.fn_current_user_has_access_permission('suppliers.evaluate'));

DROP POLICY IF EXISTS settings_select_admin ON public.settings;
CREATE POLICY settings_select_admin ON public.settings FOR SELECT TO authenticated
  USING (public.fn_current_user_has_access_permission('configuration.manage'));
DROP POLICY IF EXISTS settings_manage_admin ON public.settings;
CREATE POLICY settings_manage_admin ON public.settings FOR ALL TO authenticated
  USING (public.fn_current_user_has_access_permission('configuration.manage'))
  WITH CHECK (public.fn_current_user_has_access_permission('configuration.manage'));

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload schema';

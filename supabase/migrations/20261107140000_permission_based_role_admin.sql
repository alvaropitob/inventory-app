-- Role administration based on permissions instead of the literal role name 'admin'.
--  * roles.manage  -> create / edit / archive roles
--  * users.manage  -> assign roles and activate / deactivate users
--  * Nobody can grant (or assign roles that contain) a permission they do not hold.
--  * Custom roles are no longer forced to carry roles.manage.
--  * Role names are unique (case-insensitive) and the built-in names are reserved.
--  * The last holder of roles.manage / users.manage cannot be removed.

DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS roles_name_lower_unique ON public.roles (lower(name));
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'Existen roles con nombres duplicados; el índice único se omitió y la validación queda en la función.';
END $$;

-- ---------------------------------------------------------------------------
-- Save (create / update) a role
-- ---------------------------------------------------------------------------
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
  v_codes text[] := coalesce(p_permission_codes, ARRAY[]::text[]);
  v_name text := trim(coalesce(p_name, ''));
  v_old_codes text[] := ARRAY[]::text[];
  v_is_admin_role boolean := false;
BEGIN
  IF auth.uid() IS NULL OR NOT public.fn_current_user_has_access_permission('roles.manage') THEN
    RAISE EXCEPTION 'No tienes permiso para administrar roles.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v_name = '' OR length(v_name) > 80
     OR nullif(trim(p_reason), '') IS NULL OR length(trim(p_reason)) < 8 THEN
    RAISE EXCEPTION 'Nombre y motivo (mínimo 8 caracteres) son obligatorios.' USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(v_codes) c WHERE NOT EXISTS (
    SELECT 1 FROM public.access_permissions ap WHERE ap.code = c
  )) THEN
    RAISE EXCEPTION 'La selección contiene permisos desconocidos.' USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM public.roles r WHERE lower(r.name) = lower(v_name) AND r.id IS DISTINCT FROM p_role_id) THEN
    RAISE EXCEPTION 'Ya existe un rol con ese nombre.' USING ERRCODE = 'unique_violation';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('access-control-administration', 0));

  IF p_role_id IS NULL THEN
    IF lower(v_name) IN ('admin', 'supervisor', 'operator', 'auditor') THEN
      RAISE EXCEPTION 'Ese nombre está reservado para un rol del sistema.' USING ERRCODE = 'check_violation';
    END IF;
    INSERT INTO public.roles (name, description, is_active, code, is_system, updated_at)
    VALUES (v_name, nullif(trim(p_description), ''), true,
      lower(regexp_replace(v_name, '[^a-zA-Z0-9]+', '_', 'g')) || '_' || substr(gen_random_uuid()::text, 1, 8),
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
    IF EXISTS (SELECT 1 FROM public.roles WHERE id = p_role_id AND is_system AND name <> v_name) THEN
      RAISE EXCEPTION 'El nombre de un rol del sistema no se puede cambiar.' USING ERRCODE = 'check_violation';
    END IF;
    SELECT coalesce(array_agg(arp.permission_code), ARRAY[]::text[]) INTO v_old_codes
    FROM public.access_role_permissions arp WHERE arp.role_id = p_role_id;
    SELECT EXISTS (SELECT 1 FROM public.roles WHERE id = p_role_id AND is_system AND name = 'admin') INTO v_is_admin_role;
    IF v_is_admin_role AND NOT ('users.manage' = ANY(v_codes) AND 'roles.manage' = ANY(v_codes)) THEN
      RAISE EXCEPTION 'El perfil administrador debe conservar la administración de usuarios y de roles.' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- Nobody can grant or revoke a permission they do not hold themselves.
  IF EXISTS (
    SELECT 1 FROM (
      SELECT c FROM unnest(v_codes) c WHERE NOT (c = ANY(v_old_codes))
      UNION
      SELECT c FROM unnest(v_old_codes) c WHERE NOT (c = ANY(v_codes))
    ) diff
    WHERE NOT public.fn_current_user_has_access_permission(diff.c)
  ) THEN
    RAISE EXCEPTION 'No puedes otorgar ni retirar permisos que tú no tienes.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_role_id IS NOT NULL THEN
    UPDATE public.roles SET name = v_name, description = nullif(trim(p_description), ''), updated_at = now()
    WHERE id = p_role_id RETURNING id INTO v_role_id;
    DELETE FROM public.access_role_permissions WHERE role_id = v_role_id;
  END IF;

  INSERT INTO public.access_role_permissions (role_id, permission_code)
  SELECT v_role_id, c FROM unnest(v_codes) c
  ON CONFLICT DO NOTHING;

  -- Never leave the system without someone able to administer roles and users.
  IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.is_active AND public.fn_user_has_access_permission(u.id, 'roles.manage')) THEN
    RAISE EXCEPTION 'Este cambio dejaría al sistema sin ningún usuario que pueda administrar roles.' USING ERRCODE = 'check_violation';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.is_active AND public.fn_user_has_access_permission(u.id, 'users.manage')) THEN
    RAISE EXCEPTION 'Este cambio dejaría al sistema sin ningún usuario que pueda administrar usuarios.' USING ERRCODE = 'check_violation';
  END IF;

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

-- ---------------------------------------------------------------------------
-- Assign roles / activate users
-- ---------------------------------------------------------------------------
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
  IF auth.uid() IS NULL OR NOT public.fn_current_user_has_access_permission('users.manage') THEN
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

  -- Nobody can hand out, or take away, permissions they do not hold themselves.
  IF EXISTS (
    SELECT 1 FROM public.access_role_permissions arp
    WHERE (arp.role_id = ANY(v_role_ids)
           OR arp.role_id IN (SELECT ur.role_id FROM public.user_roles ur WHERE ur.user_id = p_target_user_id))
      AND NOT public.fn_current_user_has_access_permission(arp.permission_code)
  ) THEN
    RAISE EXCEPTION 'No puedes modificar el acceso de un usuario con permisos superiores a los tuyos.' USING ERRCODE = 'insufficient_privilege';
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
  IF public.fn_user_has_access_permission(p_target_user_id, 'roles.manage')
     AND NOT (p_is_active AND EXISTS (
       SELECT 1 FROM public.access_role_permissions arp JOIN public.roles r ON r.id = arp.role_id AND r.is_active
       WHERE r.id = ANY(v_role_ids) AND arp.permission_code = 'roles.manage'))
     AND NOT EXISTS (
       SELECT 1 FROM public.users u WHERE u.id <> p_target_user_id AND u.is_active
         AND public.fn_user_has_access_permission(u.id, 'roles.manage')
     ) THEN
    RAISE EXCEPTION 'No se puede retirar el acceso al último administrador de roles.' USING ERRCODE = 'check_violation';
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

-- ---------------------------------------------------------------------------
-- Archive a role
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_admin_archive_access_role(p_role_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_role public.roles%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.fn_current_user_has_access_permission('roles.manage') THEN
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

-- Legacy single-role entry point keeps working, now gated by users.manage.
CREATE OR REPLACE FUNCTION public.fn_update_user_access(
  p_target_user_id uuid, p_new_role_id uuid, p_new_is_active boolean
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.fn_current_user_has_access_permission('users.manage') THEN
    RAISE EXCEPTION 'No tienes permisos para administrar accesos.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  PERFORM public.fn_admin_set_user_access(p_target_user_id, ARRAY[p_new_role_id], p_new_role_id,
    p_new_is_active, 'Actualización desde la gestión de usuarios');
END;
$$;
REVOKE ALL ON FUNCTION public.fn_update_user_access(uuid, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_update_user_access(uuid, uuid, boolean) TO authenticated;

-- ---------------------------------------------------------------------------
-- Automatic propagation of new permissions to admin and (when marked
-- grant_by_default) to every active role, including custom roles.
-- ---------------------------------------------------------------------------
ALTER TABLE public.access_permissions
  ADD COLUMN IF NOT EXISTS grant_by_default boolean NOT NULL DEFAULT false;

UPDATE public.access_permissions
SET grant_by_default = true
WHERE code IN ('dashboard.view', 'pqr.submit');

CREATE OR REPLACE FUNCTION public.fn_propagate_access_permission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO public.access_role_permissions (role_id, permission_code)
  SELECT r.id, NEW.code
  FROM public.roles r
  WHERE (r.is_system AND r.name = 'admin')
     OR (NEW.grant_by_default AND r.is_active)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_propagate_access_permission() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_access_permissions_propagate ON public.access_permissions;
CREATE TRIGGER trg_access_permissions_propagate
  AFTER INSERT OR UPDATE OF grant_by_default ON public.access_permissions
  FOR EACH ROW EXECUTE FUNCTION public.fn_propagate_access_permission();

INSERT INTO public.access_role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM public.roles r
CROSS JOIN public.access_permissions p
WHERE (r.is_system AND r.name = 'admin')
   OR (p.grant_by_default AND r.is_active)
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';

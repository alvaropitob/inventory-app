-- Keep the primary role and active status in sync with the legacy user_roles table.
-- This also protects the last active administrator from accidental lockout.
UPDATE public.user_roles ur
SET is_primary = FALSE,
    updated_at = now()
FROM public.users u
WHERE ur.user_id = u.id
  AND ur.is_primary IS TRUE
  AND (u.role_id IS NULL OR ur.role_id <> u.role_id);

INSERT INTO public.user_roles (user_id, role_id, is_primary, updated_at)
SELECT u.id, u.role_id, TRUE, now()
FROM public.users u
WHERE u.role_id IS NOT NULL
ON CONFLICT (user_id, role_id)
DO UPDATE SET is_primary = TRUE, updated_at = now();

-- Use the same active public profile and primary role as the application.
CREATE OR REPLACE FUNCTION public.fn_get_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT r.name::text
  FROM public.users u
  JOIN public.roles r ON r.id = u.role_id
  WHERE u.id = auth.uid()
    AND u.is_active IS TRUE
    AND r.is_active IS TRUE
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.fn_get_user_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_get_user_role() TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_update_user_access(
  p_target_user_id uuid,
  p_new_role_id uuid,
  p_new_is_active boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor_role text;
  v_target_role text;
  v_new_role text;
  v_other_active_admins integer;
BEGIN
  IF auth.uid() IS NULL OR p_target_user_id IS NULL OR p_new_role_id IS NULL OR p_new_is_active IS NULL THEN
    RAISE EXCEPTION 'Usuario, rol y estado de acceso son obligatorios.' USING ERRCODE = '22023';
  END IF;

  -- Serialize access changes so concurrent requests cannot deactivate the final administrators.
  PERFORM pg_advisory_xact_lock(hashtextextended('user-access-administration', 0));

  SELECT r.name INTO v_actor_role
  FROM public.users u
  JOIN public.roles r ON r.id = u.role_id
  WHERE u.id = auth.uid() AND u.is_active IS TRUE AND r.is_active IS TRUE;

  IF v_actor_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'No tienes permisos para administrar accesos.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT name INTO v_new_role FROM public.roles WHERE id = p_new_role_id AND is_active IS TRUE;
  IF v_new_role IS NULL THEN
    RAISE EXCEPTION 'Selecciona un rol activo.' USING ERRCODE = 'check_violation';
  END IF;

  SELECT r.name INTO v_target_role
  FROM public.users u
  LEFT JOIN public.roles r ON r.id = u.role_id
  WHERE u.id = p_target_user_id
  FOR UPDATE OF u;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontró el usuario seleccionado.' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_target_role = 'admin' AND (v_new_role <> 'admin' OR NOT p_new_is_active) THEN
    SELECT count(*) INTO v_other_active_admins
    FROM public.users u
    JOIN public.roles r ON r.id = u.role_id
    WHERE u.is_active IS TRUE AND r.is_active IS TRUE AND r.name = 'admin'
      AND u.id <> p_target_user_id;
    IF v_other_active_admins = 0 THEN
      RAISE EXCEPTION 'No se puede retirar el acceso al último administrador activo.' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  UPDATE public.users
  SET role_id = p_new_role_id, is_active = p_new_is_active
  WHERE id = p_target_user_id;

  UPDATE public.user_roles
  SET is_primary = FALSE
  WHERE user_id = p_target_user_id AND is_primary IS TRUE;

  INSERT INTO public.user_roles (user_id, role_id, is_primary, updated_at)
  VALUES (p_target_user_id, p_new_role_id, TRUE, now())
  ON CONFLICT (user_id, role_id)
  DO UPDATE SET is_primary = TRUE, updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.fn_update_user_access(uuid, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_update_user_access(uuid, uuid, boolean) TO authenticated;

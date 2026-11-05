-- Keep one auth.users profile trigger and ensure newly created profiles
-- cannot use the application until an administrator activates them.
DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_operator_role_id uuid;
  v_profile_role_id uuid;
BEGIN
  SELECT r.id
  INTO v_operator_role_id
  FROM public.roles AS r
  WHERE r.name = 'operator'
    AND r.is_active IS TRUE
  LIMIT 1;

  IF v_operator_role_id IS NULL THEN
    RAISE EXCEPTION 'No existe un rol operator activo; no se puede crear el perfil pendiente.';
  END IF;

  -- Never grant active access or admin based on signup order or client metadata.
  INSERT INTO public.users (
    id,
    username,
    email,
    full_name,
    role_id,
    is_active
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.email, NEW.id::text),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', ''),
    v_operator_role_id,
    FALSE
  )
  ON CONFLICT (id) DO NOTHING;

  -- Preserve a pre-provisioned profile's canonical role if one already exists.
  SELECT u.role_id
  INTO v_profile_role_id
  FROM public.users AS u
  WHERE u.id = NEW.id;

  IF v_profile_role_id IS NULL THEN
    RAISE EXCEPTION 'El perfil creado no tiene un rol asignado.';
  END IF;

  UPDATE public.user_roles AS ur
  SET is_primary = FALSE,
      updated_at = pg_catalog.now()
  WHERE ur.user_id = NEW.id
    AND ur.is_primary IS TRUE
    AND ur.role_id <> v_profile_role_id;

  INSERT INTO public.user_roles (user_id, role_id, is_primary, updated_at)
  VALUES (NEW.id, v_profile_role_id, TRUE, pg_catalog.now())
  ON CONFLICT (user_id, role_id)
  DO UPDATE SET
    is_primary = TRUE,
    updated_at = pg_catalog.now();

  RETURN NEW;
END;
$$;

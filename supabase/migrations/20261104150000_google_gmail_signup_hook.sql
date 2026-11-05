-- Restrict new Supabase Auth users to Google identities with a @gmail.com address.
-- After applying this migration, enable it in Authentication > Hooks > Before User Created.
CREATE OR REPLACE FUNCTION public.hook_allow_google_gmail_signups(p_event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog
AS $$
DECLARE
  v_email text := lower(btrim(COALESCE(p_event #>> '{user,email}', '')));
  v_provider text := lower(COALESCE(p_event #>> '{user,app_metadata,provider}', ''));
BEGIN
  IF v_provider <> 'google' THEN
    RETURN jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'Solo se permite el registro con Google.'
      )
    );
  END IF;

  IF v_email !~ '^[^@]+@gmail\.com$' THEN
    RETURN jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'Solo se permiten cuentas con dirección @gmail.com.'
      )
    );
  END IF;

  RETURN '{}'::jsonb;
END;
$$;

REVOKE ALL ON FUNCTION public.hook_allow_google_gmail_signups(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hook_allow_google_gmail_signups(jsonb) TO supabase_auth_admin;

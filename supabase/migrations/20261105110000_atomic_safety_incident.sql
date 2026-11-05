-- Store a safety incident and quarantine/reject the affected batch atomically.
-- Keep the existing insert policy briefly so the current deployment continues
-- working until the application code using this RPC is deployed. Lock it down
-- in 20261105120000_lock_safety_incident_inserts.sql after that deployment.
CREATE OR REPLACE FUNCTION public.fn_report_safety_incident(
  p_batch_id uuid,
  p_incident_type text,
  p_description text,
  p_action_taken text,
  p_reported_by uuid
)
RETURNS SETOF public.safety_incidents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_role text;
  v_input public.safety_incidents;
  v_incident public.safety_incidents;
  v_updated integer;
BEGIN
  IF auth.uid() IS NULL OR p_reported_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'El reportante debe ser el usuario autenticado.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_role := public.fn_get_user_role();
  IF v_role NOT IN ('admin', 'operator', 'supervisor') THEN
    RAISE EXCEPTION 'No tienes permisos para reportar incidentes de seguridad.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_batch_id IS NULL
     OR p_incident_type IS NULL
     OR p_incident_type NOT IN ('recall', 'adverse_event', 'quality_failure', 'other')
     OR nullif(trim(p_description), '') IS NULL THEN
    RAISE EXCEPTION 'Completa un lote, tipo y descripción válidos.' USING ERRCODE = 'check_violation';
  END IF;

  -- Populate the table composite so the database casts incident_type correctly
  -- whether that column is text or a project enum.
  v_input := pg_catalog.jsonb_populate_record(
    NULL::public.safety_incidents,
    pg_catalog.jsonb_build_object(
      'batch_id', p_batch_id,
      'incident_type', p_incident_type,
      'description', p_description,
      'action_taken', p_action_taken,
      'reported_by', p_reported_by
    )
  );

  INSERT INTO public.safety_incidents (
    batch_id, incident_type, description, action_taken, reported_by
  ) VALUES (
    v_input.batch_id, v_input.incident_type, v_input.description,
    v_input.action_taken, v_input.reported_by
  ) RETURNING * INTO v_incident;

  IF p_incident_type IN ('recall', 'quality_failure') THEN
    UPDATE public.inventory_batches
    SET status = 'rejected',
        clinical_status = 'rejected'
    WHERE id = p_batch_id;

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated = 0 THEN
      RAISE EXCEPTION 'No se encontró el lote indicado.' USING ERRCODE = 'no_data_found';
    END IF;
  END IF;

  RETURN NEXT v_incident;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_report_safety_incident(uuid, text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_report_safety_incident(uuid, text, text, text, uuid) TO authenticated;

-- Superseded by the atomic function above.
DROP FUNCTION IF EXISTS public.fn_reject_batch_for_safety_incident(uuid);

NOTIFY pgrst, 'reload schema';

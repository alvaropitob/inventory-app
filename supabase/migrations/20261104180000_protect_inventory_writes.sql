-- Inventory mutations already run through SECURITY DEFINER workflows. Remove
-- direct table writes so clients cannot fabricate stock or movement history.

DROP POLICY IF EXISTS batches_insert_admin_operator ON public.inventory_batches;
DROP POLICY IF EXISTS batches_update_admin_supervisor ON public.inventory_batches;
DROP POLICY IF EXISTS batches_update_operator_limited ON public.inventory_batches;
REVOKE ALL ON public.inventory_batches FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.inventory_batches TO authenticated;

DROP POLICY IF EXISTS movements_insert_admin_operator ON public.stock_movements;
DROP POLICY IF EXISTS movements_insert_supervisor_adjustments ON public.stock_movements;
REVOKE ALL ON public.stock_movements FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.stock_movements TO authenticated;

-- Record and apply a recall/quality failure to its batch using one privileged,
-- role-checked database operation. The incident must already belong to caller.
CREATE OR REPLACE FUNCTION public.fn_reject_batch_for_safety_incident(
  p_batch_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_role text;
  v_updated integer;
BEGIN
  IF auth.uid() IS NULL OR p_batch_id IS NULL THEN
    RAISE EXCEPTION 'Usuario y lote son obligatorios.' USING ERRCODE = '22023';
  END IF;

  v_role := public.fn_get_user_role();
  IF v_role NOT IN ('admin', 'operator', 'supervisor') THEN
    RAISE EXCEPTION 'No tienes permisos para reportar este incidente.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.safety_incidents si
    WHERE si.batch_id = p_batch_id
      AND si.reported_by = auth.uid()
      AND si.incident_type::text IN ('recall', 'quality_failure')
  ) THEN
    RAISE EXCEPTION 'No existe un incidente de retiro o falla de calidad reportado por este usuario para el lote.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE public.inventory_batches
  SET status = 'rejected',
      clinical_status = 'rejected'
  WHERE id = p_batch_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RAISE EXCEPTION 'No se encontró el lote indicado.' USING ERRCODE = 'no_data_found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_reject_batch_for_safety_incident(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_reject_batch_for_safety_incident(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';

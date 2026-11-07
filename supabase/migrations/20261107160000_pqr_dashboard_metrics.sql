-- Accurate PQR dashboard metrics, independent from the current pagination page.
CREATE OR REPLACE FUNCTION public.fn_pqr_dashboard_metrics(p_scope text DEFAULT 'all')
RETURNS TABLE(
  open_count bigint,
  urgent_open_count bigint,
  unassigned_open_count bigint,
  resolved_count bigint,
  avg_resolution_seconds numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_scope text := p_scope;
  v_can_manage boolean := public.fn_current_user_has_access_permission('pqr.manage');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT v_can_manage AND NOT public.fn_current_user_has_access_permission('pqr.submit') THEN
    RAISE EXCEPTION 'No tienes permiso para consultar PQR' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT v_can_manage THEN
    v_scope := 'mine';
  ELSIF v_scope NOT IN ('all', 'mine', 'assigned') THEN
    RAISE EXCEPTION 'Alcance de consulta no válido' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  RETURN QUERY
  SELECT
    count(*) FILTER (WHERE t.status IN ('open', 'in_review', 'in_progress', 'waiting_user')),
    count(*) FILTER (WHERE t.status IN ('open', 'in_review', 'in_progress', 'waiting_user') AND t.priority IN ('high', 'critical')),
    count(*) FILTER (WHERE t.status IN ('open', 'in_review', 'in_progress', 'waiting_user') AND t.assigned_to IS NULL),
    count(*) FILTER (WHERE t.resolved_at IS NOT NULL),
    avg(extract(epoch FROM (t.resolved_at - t.created_at))) FILTER (WHERE t.resolved_at IS NOT NULL)
  FROM public.pqr_tickets t
  WHERE v_scope = 'all'
     OR (v_scope = 'mine' AND t.reporter_id = auth.uid())
     OR (v_scope = 'assigned' AND t.assigned_to = auth.uid());
END;
$$;

REVOKE ALL ON FUNCTION public.fn_pqr_dashboard_metrics(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_pqr_dashboard_metrics(text) TO authenticated;

NOTIFY pgrst, 'reload schema';

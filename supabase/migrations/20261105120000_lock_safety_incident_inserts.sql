-- Run after deploying the application version that calls fn_report_safety_incident.
DROP POLICY IF EXISTS safety_incidents_insert_authorized_roles ON public.safety_incidents;
REVOKE INSERT ON public.safety_incidents FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.safety_incidents TO authenticated;

NOTIFY pgrst, 'reload schema';

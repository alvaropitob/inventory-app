-- RLS already limits these tables to authenticated users and role policies.
-- Remove inherited PUBLIC/anon table grants as an additional privilege boundary.
REVOKE ALL ON public.equipments,
  public.maintenance_records,
  public.services,
  public.settings,
  public.supplier_evaluations,
  public.users,
  public.user_roles
FROM PUBLIC, anon;

-- Keep only the table privileges used by authenticated application workflows.
REVOKE UPDATE, DELETE ON public.supplier_evaluations FROM authenticated;
GRANT SELECT, INSERT ON public.supplier_evaluations TO authenticated;

GRANT SELECT ON public.user_roles TO authenticated;

NOTIFY pgrst, 'reload schema';

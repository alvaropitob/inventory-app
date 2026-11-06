-- Restore authenticated read policies removed by the access-hardening migration.
-- Inventory transfers and other operational selectors need to read these masters.

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.locations, public.sections, public.suppliers FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.locations, public.sections, public.suppliers
  TO authenticated;

DROP POLICY IF EXISTS locations_select_staff ON public.locations;
CREATE POLICY locations_select_staff
  ON public.locations FOR SELECT TO authenticated
  USING (public.fn_get_user_role() IN ('admin', 'supervisor', 'operator', 'auditor'));

DROP POLICY IF EXISTS locations_manage_admin ON public.locations;
CREATE POLICY locations_manage_admin
  ON public.locations FOR ALL TO authenticated
  USING (public.fn_get_user_role() = 'admin')
  WITH CHECK (public.fn_get_user_role() = 'admin');

DROP POLICY IF EXISTS sections_select_staff ON public.sections;
CREATE POLICY sections_select_staff
  ON public.sections FOR SELECT TO authenticated
  USING (public.fn_get_user_role() IN ('admin', 'supervisor', 'operator', 'auditor'));

DROP POLICY IF EXISTS sections_manage_admin ON public.sections;
CREATE POLICY sections_manage_admin
  ON public.sections FOR ALL TO authenticated
  USING (public.fn_get_user_role() = 'admin')
  WITH CHECK (public.fn_get_user_role() = 'admin');

DROP POLICY IF EXISTS suppliers_select_staff ON public.suppliers;
CREATE POLICY suppliers_select_staff
  ON public.suppliers FOR SELECT TO authenticated
  USING (public.fn_get_user_role() IN ('admin', 'supervisor', 'operator', 'auditor'));

DROP POLICY IF EXISTS suppliers_manage_admin ON public.suppliers;
CREATE POLICY suppliers_manage_admin
  ON public.suppliers FOR ALL TO authenticated
  USING (public.fn_get_user_role() = 'admin')
  WITH CHECK (public.fn_get_user_role() = 'admin');

NOTIFY pgrst, 'reload schema';

-- Structured supplier evaluations, monthly safety alert indicators, and equipment metadata.

ALTER TABLE IF EXISTS public.supplier_evaluations
  ADD COLUMN IF NOT EXISTS supplier_email text,
  ADD COLUMN IF NOT EXISTS evaluator_name text,
  ADD COLUMN IF NOT EXISTS evaluator_role text,
  ADD COLUMN IF NOT EXISTS answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS applicable_questions integer,
  ADD COLUMN IF NOT EXISTS points_possible integer,
  ADD COLUMN IF NOT EXISTS percentage_score numeric(5,2),
  ADD COLUMN IF NOT EXISTS rating text;

ALTER TABLE IF EXISTS public.maintenance_records
  ADD COLUMN IF NOT EXISTS scheduled_date date,
  ADD COLUMN IF NOT EXISTS provider_name text;

ALTER TABLE IF EXISTS public.equipments
  ADD COLUMN IF NOT EXISTS inventory_number text,
  ADD COLUMN IF NOT EXISTS section_id uuid REFERENCES public.sections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS measurement_range text,
  ADD COLUMN IF NOT EXISTS sanitary_registration text,
  ADD COLUMN IF NOT EXISTS risk_classification text,
  ADD COLUMN IF NOT EXISTS calibration_frequency text,
  ADD COLUMN IF NOT EXISTS maintenance_frequency text,
  ADD COLUMN IF NOT EXISTS responsible text;

CREATE TABLE IF NOT EXISTS public.safety_alert_monthly_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_month date NOT NULL UNIQUE,
  verified_device_reagent_alerts integer NOT NULL DEFAULT 0 CHECK (verified_device_reagent_alerts >= 0),
  verified_device_reagent_security_reports integer NOT NULL DEFAULT 0 CHECK (verified_device_reagent_security_reports >= 0),
  verified_medicine_biological_reports integer NOT NULL DEFAULT 0 CHECK (verified_medicine_biological_reports >= 0),
  managed_reactivovigilance integer NOT NULL DEFAULT 0 CHECK (managed_reactivovigilance >= 0),
  managed_tecnovigilance integer NOT NULL DEFAULT 0 CHECK (managed_tecnovigilance >= 0),
  managed_pharmacovigilance integer NOT NULL DEFAULT 0 CHECK (managed_pharmacovigilance >= 0),
  vigilance_percentage numeric(5,2) NOT NULL DEFAULT 0 CHECK (vigilance_percentage BETWEEN 0 AND 100),
  notes text,
  recorded_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT safety_alert_month_first_day CHECK (EXTRACT(DAY FROM period_month) = 1)
);

ALTER TABLE public.safety_alert_monthly_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS safety_alert_monthly_reports_select_staff ON public.safety_alert_monthly_reports;
CREATE POLICY safety_alert_monthly_reports_select_staff
  ON public.safety_alert_monthly_reports FOR SELECT TO authenticated
  USING (public.fn_get_user_role() IN ('admin', 'supervisor', 'operator', 'auditor'));

DROP POLICY IF EXISTS safety_alert_monthly_reports_insert_managers ON public.safety_alert_monthly_reports;
CREATE POLICY safety_alert_monthly_reports_insert_managers
  ON public.safety_alert_monthly_reports FOR INSERT TO authenticated
  WITH CHECK (public.fn_get_user_role() IN ('admin', 'supervisor'));

DROP POLICY IF EXISTS safety_alert_monthly_reports_update_managers ON public.safety_alert_monthly_reports;
CREATE POLICY safety_alert_monthly_reports_update_managers
  ON public.safety_alert_monthly_reports FOR UPDATE TO authenticated
  USING (public.fn_get_user_role() IN ('admin', 'supervisor'))
  WITH CHECK (public.fn_get_user_role() IN ('admin', 'supervisor'));

GRANT SELECT, INSERT, UPDATE ON public.safety_alert_monthly_reports TO authenticated;

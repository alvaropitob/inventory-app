-- Fix broken legacy trigger on public.quality_verifications that fails with:
-- ERROR 42704: type "clinical_status_type" does not exist
-- Synchronize status, clinical_status, acceptance_test_status, and verified_by
-- on public.inventory_batches using untyped string literals so PostgreSQL
-- coerces them cleanly whether the target columns are text or enum types.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT tgname
    FROM pg_trigger
    WHERE tgrelid = 'public.quality_verifications'::regclass
      AND NOT tgisinternal
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.quality_verifications', r.tgname);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_sync_batch_on_quality_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.result = 'pass' THEN
    UPDATE public.inventory_batches
    SET status = 'accepted',
        clinical_status = 'accepted',
        acceptance_test_status = 'passed',
        verified_by = COALESCE(NEW.verified_by, auth.uid())
    WHERE id = NEW.batch_id;
  ELSE
    UPDATE public.inventory_batches
    SET status = 'rejected',
        clinical_status = 'rejected',
        acceptance_test_status = 'failed',
        verified_by = COALESCE(NEW.verified_by, auth.uid())
    WHERE id = NEW.batch_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_batch_on_quality_verification
  AFTER INSERT ON public.quality_verifications
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_sync_batch_on_quality_verification();

DO $$
BEGIN
  IF to_regproc('public.fn_audit_log()') IS NOT NULL THEN
    EXECUTE 'CREATE TRIGGER trg_audit_quality_verifications AFTER INSERT OR UPDATE OR DELETE ON public.quality_verifications FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log()';
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';

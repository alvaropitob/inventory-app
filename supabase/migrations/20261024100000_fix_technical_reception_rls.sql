-- The reception RPC authorizes operators itself, but its updates to purchase
-- order items must run with the function owner's privileges because RLS only
-- allows admins and supervisors to update those rows directly.
ALTER FUNCTION public.fn_register_technical_reception(
  uuid, text, text, boolean, numeric, boolean, text, jsonb
) SECURITY DEFINER;

ALTER FUNCTION public.fn_register_technical_reception(
  uuid, text, text, boolean, numeric, boolean, text, jsonb
) SET search_path = public;

REVOKE ALL ON FUNCTION public.fn_register_technical_reception(
  uuid, text, text, boolean, numeric, boolean, text, jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_register_technical_reception(
  uuid, text, text, boolean, numeric, boolean, text, jsonb
) TO authenticated;

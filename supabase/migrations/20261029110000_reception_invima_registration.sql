ALTER TABLE public.catalog_items
  ADD COLUMN IF NOT EXISTS sanitary_registration text;

CREATE OR REPLACE FUNCTION public.fn_update_catalog_item_sanitary_registration(
  p_item_id uuid,
  p_registration text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.fn_get_user_role() NOT IN ('admin', 'operator') THEN
    RAISE EXCEPTION 'Unauthorized catalog registration update' USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE public.catalog_items
  SET sanitary_registration = nullif(trim(p_registration), '')
  WHERE id = p_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Catalog item not found' USING ERRCODE = 'no_data_found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_update_catalog_item_sanitary_registration(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_update_catalog_item_sanitary_registration(uuid, text) TO authenticated;

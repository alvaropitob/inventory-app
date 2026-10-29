-- The browser supplies the selected internal-unit count for display, but it is
-- not authoritative for inventory accounting. Derive it from the catalog row
-- while the batch is locked and reject mismatches before changing stock.
CREATE OR REPLACE FUNCTION public.fn_consume_fractional_inventory_batch(
  p_batch_id uuid,
  p_units integer,
  p_units_per_package integer,
  p_consumed_by uuid,
  p_reason text,
  p_equipment_name text DEFAULT NULL,
  p_fefo_deviation boolean DEFAULT false,
  p_justification_reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch public.inventory_batches%ROWTYPE;
  v_opened_units integer;
  v_units_per_package integer;
  v_remaining_open_units integer;
  v_packages_needed integer;
  v_fefo_deviation boolean;
  v_presentation text;
  v_matches text[];
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_consumed_by
     OR public.fn_get_user_role() NOT IN ('admin', 'operator') THEN
    RAISE EXCEPTION 'Unauthorized inventory consumption' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_batch_id IS NULL OR p_units IS NULL OR p_units <= 0
     OR p_units_per_package IS NULL OR p_units_per_package <= 1
     OR nullif(trim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'Invalid fractional consumption data' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_batch
  FROM public.inventory_batches
  WHERE id = p_batch_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inventory batch not found' USING ERRCODE = 'no_data_found'; END IF;

  SELECT commercial_presentation INTO v_presentation
  FROM public.catalog_items
  WHERE id = v_batch.item_id;

  IF nullif(trim(v_presentation), '') IS NOT NULL
     AND lower(trim(v_presentation)) <> 'no aplica' THEN
    IF trim(v_presentation) ~ '^[0-9]+$' THEN
      v_units_per_package := trim(v_presentation)::integer;
    ELSE
      v_matches := regexp_match(v_presentation, '(?:x|por|\*)[[:space:]]*([0-9]+)', 'i');
      IF v_matches IS NOT NULL THEN
        v_units_per_package := v_matches[1]::integer;
      ELSE
        v_matches := regexp_match(
          v_presentation,
          '([0-9]+)[[:space:]]*(determinaciones|det|pruebas?|tests?|unidades?|dosis|tubos?|tiras?)',
          'i'
        );
        IF v_matches IS NOT NULL THEN
          v_units_per_package := v_matches[1]::integer;
        END IF;
      END IF;
    END IF;
  END IF;

  IF v_units_per_package IS NULL OR v_units_per_package <= 1 THEN
    RAISE EXCEPTION 'Catalog presentation does not define a valid fractional package size'
      USING ERRCODE = 'check_violation';
  END IF;
  IF p_units_per_package <> v_units_per_package THEN
    RAISE EXCEPTION 'Package size mismatch: catalog has %, request supplied %',
      v_units_per_package, p_units_per_package
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_batch.expiration_date < CURRENT_DATE
     OR coalesce(v_batch.adjusted_expiration_date, v_batch.expiration_date) < CURRENT_DATE THEN
    RAISE EXCEPTION 'Expired batches cannot be consumed' USING ERRCODE = 'check_violation';
  END IF;
  IF v_batch.status::text IN ('quarantine', 'rejected', 'expired')
     OR v_batch.clinical_status::text IN ('quarantine', 'rejected', 'expired')
     OR (v_batch.status IS NOT NULL AND v_batch.status::text <> 'accepted')
     OR (v_batch.clinical_status IS NOT NULL AND v_batch.clinical_status::text <> 'accepted')
     OR (v_batch.status IS NULL AND v_batch.clinical_status IS NULL) THEN
    RAISE EXCEPTION 'Only accepted batches can be consumed' USING ERRCODE = 'check_violation';
  END IF;

  v_opened_units := coalesce(v_batch.opened_units_remaining, 0);
  IF v_opened_units > 0
     AND coalesce(v_batch.opened_units_per_package, 0) <> v_units_per_package THEN
    RAISE EXCEPTION 'Package presentation differs from the package already opened for this batch'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_units > v_opened_units + (v_batch.current_stock * v_units_per_package) THEN
    RAISE EXCEPTION 'Insufficient fractional stock; available: % units',
      v_opened_units + (v_batch.current_stock * v_units_per_package)
      USING ERRCODE = 'check_violation';
  END IF;

  v_packages_needed := greatest(0, ceil(greatest(0, p_units - v_opened_units)::numeric / v_units_per_package)::integer);
  IF v_packages_needed > v_batch.current_stock THEN
    RAISE EXCEPTION 'Insufficient unopened packages' USING ERRCODE = 'check_violation';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.inventory_batches b
    WHERE b.item_id = v_batch.item_id
      AND b.id <> v_batch.id
      AND (b.current_stock > 0 OR coalesce(b.opened_units_remaining, 0) > 0)
      AND b.expiration_date >= CURRENT_DATE
      AND coalesce(b.adjusted_expiration_date, b.expiration_date) >= CURRENT_DATE
      AND coalesce(b.adjusted_expiration_date, b.expiration_date) <
          coalesce(v_batch.adjusted_expiration_date, v_batch.expiration_date)
      AND (b.status IS NULL OR b.status::text = 'accepted')
      AND (b.clinical_status IS NULL OR b.clinical_status::text = 'accepted')
  ) INTO v_fefo_deviation;
  IF p_fefo_deviation AND NOT v_fefo_deviation THEN
    RAISE EXCEPTION 'The selected batch is no longer a FEFO deviation; refresh the inventory list'
      USING ERRCODE = 'serialization_failure';
  END IF;
  IF v_fefo_deviation AND nullif(trim(p_justification_reason), '') IS NULL THEN
    RAISE EXCEPTION 'FEFO deviation requires a technical justification' USING ERRCODE = 'check_violation';
  END IF;

  IF v_packages_needed > 0 THEN
    PERFORM public.fn_consume_inventory_batch(
      p_batch_id,
      v_packages_needed,
      p_consumed_by,
      '[FRACCIONAL_PACKAGE_OPEN] ' || trim(p_reason) || ' (apertura de ' || v_packages_needed || ' empaque(s); retiro de ' || p_units || ' unidades internas)',
      p_equipment_name,
      true,
      false,
      false,
      p_justification_reason
    );
  END IF;

  v_remaining_open_units := v_opened_units + (v_packages_needed * v_units_per_package) - p_units;
  UPDATE public.inventory_batches
  SET opened_units_remaining = v_remaining_open_units,
      opened_units_per_package = CASE WHEN v_remaining_open_units > 0 THEN v_units_per_package ELSE 0 END,
      opening_date = coalesce(opening_date, now())
  WHERE id = p_batch_id;

  INSERT INTO public.inventory_fractional_movements (
    batch_id, user_id, units_withdrawn, units_per_package, packages_opened, reason, equipment_name
  ) VALUES (
    p_batch_id, p_consumed_by, p_units, v_units_per_package, v_packages_needed,
    CASE WHEN v_fefo_deviation
      THEN '[FEFO DEVIATION] ' || trim(p_justification_reason) || ' | Reason: ' || trim(p_reason)
      ELSE trim(p_reason)
    END,
    nullif(trim(p_equipment_name), '')
  );

  RETURN p_batch_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_consume_fractional_inventory_batch(uuid, integer, integer, uuid, text, text, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_consume_fractional_inventory_batch(uuid, integer, integer, uuid, text, text, boolean, text) TO authenticated;

NOTIFY pgrst, 'reload schema';

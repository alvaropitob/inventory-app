-- Track unopened purchase units separately from inner units in opened packages.
-- Fractional withdrawals are recorded in their own ledger.
ALTER TABLE public.inventory_batches
  ADD COLUMN IF NOT EXISTS opened_units_remaining integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opened_units_per_package integer NOT NULL DEFAULT 0;

ALTER TABLE public.inventory_batches
  DROP CONSTRAINT IF EXISTS inventory_batches_opened_units_check;
ALTER TABLE public.inventory_batches
  ADD CONSTRAINT inventory_batches_opened_units_check CHECK (
    opened_units_remaining >= 0
    AND opened_units_per_package >= 0
    AND (opened_units_remaining = 0 OR opened_units_per_package > 1)
  );

-- Recover known open-kit balances from older exits. Previous versions logged
-- the internal units but deducted a whole package; those units remain usable.
WITH legacy_fractional_exits AS (
  SELECT
    batch_id,
    sum(greatest(0, (parts[2])::integer - (parts[1])::integer))::integer AS remaining_units,
    max((parts[2])::integer) AS units_per_package
  FROM (
    SELECT batch_id,
           regexp_match(reason, 'Consumo fraccionado: ([0-9]+) de ([0-9]+) unidades/pruebas') AS parts
    FROM public.stock_movements
    WHERE movement_type = 'exit'
      AND reason ~ 'Consumo fraccionado: [0-9]+ de [0-9]+ unidades/pruebas'
  ) parsed
  GROUP BY batch_id
)
UPDATE public.inventory_batches b
SET opened_units_remaining = legacy.remaining_units,
    opened_units_per_package = legacy.units_per_package,
    opening_date = coalesce(b.opening_date, now())
FROM legacy_fractional_exits legacy
WHERE b.id = legacy.batch_id AND legacy.remaining_units > 0;

CREATE TABLE IF NOT EXISTS public.inventory_fractional_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.inventory_batches(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES public.users(id),
  units_withdrawn integer NOT NULL CHECK (units_withdrawn > 0),
  units_per_package integer NOT NULL CHECK (units_per_package > 1),
  packages_opened integer NOT NULL DEFAULT 0 CHECK (packages_opened >= 0),
  reason text NOT NULL,
  equipment_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_fractional_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view fractional inventory movements" ON public.inventory_fractional_movements;
CREATE POLICY "Authenticated users can view fractional inventory movements"
  ON public.inventory_fractional_movements FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.inventory_fractional_movements TO authenticated;

-- Keep the regular package withdrawal FEFO check aware of opened-unit stock.
CREATE OR REPLACE FUNCTION public.fn_consume_inventory_batch(
  p_batch_id uuid,
  p_quantity integer,
  p_consumed_by uuid,
  p_reason text,
  p_equipment_name text DEFAULT NULL,
  p_mark_as_opened boolean DEFAULT false,
  p_reconstituted boolean DEFAULT false,
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
  v_fefo_deviation boolean;
  v_final_reason text;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_consumed_by
     OR public.fn_get_user_role() NOT IN ('admin', 'operator') THEN
    RAISE EXCEPTION 'Unauthorized inventory consumption' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 OR nullif(trim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'Invalid consumption quantity or reason' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_batch FROM public.inventory_batches WHERE id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inventory batch not found' USING ERRCODE = 'no_data_found'; END IF;
  IF v_batch.current_stock < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock; available: %', v_batch.current_stock USING ERRCODE = 'check_violation';
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
  v_final_reason := CASE WHEN v_fefo_deviation
    THEN '[FEFO DEVIATION] ' || trim(p_justification_reason) || ' | Reason: ' || trim(p_reason)
    ELSE trim(p_reason)
  END;

  INSERT INTO public.stock_movements (
    batch_id, user_id, movement_type, quantity, reason, equipment_name
  ) VALUES (
    p_batch_id, p_consumed_by, 'exit', p_quantity, v_final_reason, p_equipment_name
  );

  UPDATE public.inventory_batches SET
    opening_date = CASE WHEN p_mark_as_opened AND opening_date IS NULL THEN now() ELSE opening_date END,
    reconstitution_datetime = CASE WHEN p_reconstituted THEN now() ELSE reconstitution_datetime END
  WHERE id = p_batch_id;

  RETURN p_batch_id;
END;
$$;

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
  v_packages_needed integer;
  v_remaining_open_units integer;
  v_fefo_deviation boolean;
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
     AND coalesce(v_batch.opened_units_per_package, 0) <> p_units_per_package THEN
    RAISE EXCEPTION 'Package presentation differs from the package already opened for this batch'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_units > v_opened_units + (v_batch.current_stock * p_units_per_package) THEN
    RAISE EXCEPTION 'Insufficient fractional stock; available: % units',
      v_opened_units + (v_batch.current_stock * p_units_per_package)
      USING ERRCODE = 'check_violation';
  END IF;

  v_packages_needed := greatest(0, ceil(greatest(0, p_units - v_opened_units)::numeric / p_units_per_package)::integer);
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
    -- Reuse the established atomic package-consumption path so current_stock,
    -- movement history, audit and opening-date handling stay consistent.
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

  v_remaining_open_units := v_opened_units + (v_packages_needed * p_units_per_package) - p_units;
  UPDATE public.inventory_batches
  SET opened_units_remaining = v_remaining_open_units,
      opened_units_per_package = CASE WHEN v_remaining_open_units > 0 THEN p_units_per_package ELSE 0 END,
      opening_date = coalesce(opening_date, now())
  WHERE id = p_batch_id;

  INSERT INTO public.inventory_fractional_movements (
    batch_id, user_id, units_withdrawn, units_per_package, packages_opened, reason, equipment_name
  ) VALUES (
    p_batch_id, p_consumed_by, p_units, p_units_per_package, v_packages_needed,
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

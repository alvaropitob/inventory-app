-- Configurable temperature ranges per storage/monitoring location.

ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS temperature_min numeric,
  ADD COLUMN IF NOT EXISTS temperature_max numeric;

-- Seed existing locations from the storage types already used by the app.
-- Administrators can adjust these values to the approved local protocol.
UPDATE public.locations
SET temperature_min = COALESCE(temperature_min,
      CASE location_type
        WHEN 'refrigerated' THEN 2
        WHEN 'room_temp' THEN 15
        WHEN 'frozen' THEN -25
      END),
    temperature_max = COALESCE(temperature_max,
      CASE location_type
        WHEN 'refrigerated' THEN 8
        WHEN 'room_temp' THEN 25
        WHEN 'frozen' THEN -15
      END)
WHERE temperature_min IS NULL OR temperature_max IS NULL;

ALTER TABLE public.locations
  DROP CONSTRAINT IF EXISTS locations_temperature_range_check;
ALTER TABLE public.locations
  ADD CONSTRAINT locations_temperature_range_check
  CHECK (
    (temperature_min IS NULL AND temperature_max IS NULL)
    OR (temperature_min IS NOT NULL AND temperature_max IS NOT NULL AND temperature_min < temperature_max)
  );

ALTER TABLE public.environmental_readings
  ADD COLUMN IF NOT EXISTS temperature_min_at_reading numeric,
  ADD COLUMN IF NOT EXISTS temperature_max_at_reading numeric;

ALTER TABLE public.environmental_readings
  DROP CONSTRAINT IF EXISTS environmental_readings_temperature_range_check;
ALTER TABLE public.environmental_readings
  ADD CONSTRAINT environmental_readings_temperature_range_check
  CHECK (
    (temperature_min_at_reading IS NULL AND temperature_max_at_reading IS NULL)
    OR (
      temperature_min_at_reading IS NOT NULL
      AND temperature_max_at_reading IS NOT NULL
      AND temperature_min_at_reading < temperature_max_at_reading
    )
  );

-- Existing environmental readings are append-only and are never updated here.
-- The application classifies historical rows using the current location range
-- when no range snapshot exists; new rows receive an immutable snapshot below.

CREATE OR REPLACE FUNCTION public.fn_apply_environmental_temperature_range()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_temperature_min numeric;
  v_temperature_max numeric;
BEGIN
  SELECT temperature_min, temperature_max
    INTO v_temperature_min, v_temperature_max
  FROM public.locations
  WHERE id = NEW.location_id;

  IF v_temperature_min IS NULL OR v_temperature_max IS NULL THEN
    RAISE EXCEPTION 'Configure el rango de temperatura para esta ubicación antes de registrar lecturas.'
      USING ERRCODE = 'check_violation';
  END IF;
  IF v_temperature_min >= v_temperature_max THEN
    RAISE EXCEPTION 'El rango de temperatura de la ubicación no es válido.'
      USING ERRCODE = 'check_violation';
  END IF;

  NEW.temperature_min_at_reading := v_temperature_min;
  NEW.temperature_max_at_reading := v_temperature_max;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS zzz_environmental_temperature_range ON public.environmental_readings;
CREATE TRIGGER zzz_environmental_temperature_range
  BEFORE INSERT ON public.environmental_readings
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_apply_environmental_temperature_range();

REVOKE ALL ON FUNCTION public.fn_apply_environmental_temperature_range() FROM PUBLIC;

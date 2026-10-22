CREATE OR REPLACE FUNCTION public.fn_record_environmental_reading(
  p_location_id uuid,
  p_temperature numeric,
  p_humidity numeric,
  p_reading_type public.reading_type,
  p_is_correction boolean DEFAULT false,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_reading_date date;
  v_start timestamptz;
  v_has_reading boolean;
  v_reading_id uuid;
BEGIN
  IF v_user_id IS NULL OR public.fn_get_user_role() NOT IN ('admin', 'operator') THEN
    RAISE EXCEPTION 'Unauthorized environmental reading' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_location_id IS NULL OR p_temperature IS NULL OR p_reading_type IS NULL THEN
    RAISE EXCEPTION 'Location, temperature and reading shift are required' USING ERRCODE = 'check_violation';
  END IF;
  IF p_is_correction AND nullif(trim(p_notes), '') IS NULL THEN
    RAISE EXCEPTION 'Environmental reading corrections require a reason' USING ERRCODE = 'check_violation';
  END IF;

  v_reading_date := timezone('America/Bogota', now())::date;
  v_start := v_reading_date::timestamp AT TIME ZONE 'America/Bogota';
  PERFORM pg_advisory_xact_lock(hashtextextended(
    concat_ws('|', p_location_id::text, v_reading_date::text, p_reading_type::text), 0
  ));

  SELECT EXISTS (
    SELECT 1
    FROM public.environmental_readings
    WHERE location_id = p_location_id
      AND reading_type = p_reading_type
      AND created_at >= v_start
      AND created_at < v_start + interval '1 day'
  ) INTO v_has_reading;

  IF v_has_reading AND NOT p_is_correction THEN
    RAISE EXCEPTION 'A reading already exists for this location, date and shift' USING ERRCODE = 'unique_violation';
  END IF;
  IF p_is_correction AND NOT v_has_reading THEN
    RAISE EXCEPTION 'There is no reading to correct for this location, date and shift' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.environmental_readings (
    location_id, user_id, temperature, humidity, reading_type, notes
  ) VALUES (
    p_location_id,
    v_user_id,
    p_temperature,
    p_humidity,
    p_reading_type,
    CASE WHEN p_is_correction
      THEN '[CORRECCIÓN] ' || trim(p_notes)
      ELSE nullif(trim(p_notes), '')
    END
  ) RETURNING id INTO v_reading_id;

  RETURN v_reading_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_record_environmental_reading(uuid, numeric, numeric, public.reading_type, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_record_environmental_reading(uuid, numeric, numeric, public.reading_type, boolean, text) TO authenticated;

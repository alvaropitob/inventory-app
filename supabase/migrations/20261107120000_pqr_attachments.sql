-- Screenshots for internal PQR tickets.
-- Files live in a private Storage bucket and are uploaded straight from the
-- browser with the user's session; Storage policies, bucket limits and the
-- registration function below enforce who can upload and who can read.

-- ---------------------------------------------------------------------------
-- Access helper used by Storage policies
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_pqr_can_access_ticket(p_ticket_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pqr_tickets t
    WHERE p_ticket_id ~ '^[0-9a-f-]{36}$'
      AND t.id::text = p_ticket_id
      AND t.status NOT IN ('closed', 'rejected')
      AND (
        public.fn_current_user_has_access_permission('pqr.manage')
        OR (t.reporter_id = auth.uid() AND public.fn_current_user_has_access_permission('pqr.submit'))
      )
  )
$$;
REVOKE ALL ON FUNCTION public.fn_pqr_can_access_ticket(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_pqr_can_access_ticket(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Private bucket (5 MB, images only)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('pqr-attachments', 'pqr-attachments', false, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE
SET public = false, file_size_limit = 5242880, allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp'];

-- ---------------------------------------------------------------------------
-- Attachment metadata
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pqr_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.pqr_tickets(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.pqr_events(id) ON DELETE SET NULL,
  storage_path text NOT NULL UNIQUE,
  file_name text NOT NULL CHECK (char_length(file_name) BETWEEN 1 AND 120),
  mime_type text NOT NULL CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/webp')),
  size_bytes bigint NOT NULL CHECK (size_bytes BETWEEN 1 AND 5242880),
  is_internal boolean NOT NULL DEFAULT false,
  uploaded_by uuid NOT NULL REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pqr_attachments_ticket ON public.pqr_attachments (ticket_id, created_at);

ALTER TABLE public.pqr_attachments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pqr_attachments_select ON public.pqr_attachments;
CREATE POLICY pqr_attachments_select ON public.pqr_attachments FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.pqr_tickets t WHERE t.id = pqr_attachments.ticket_id)
    AND (NOT is_internal OR public.fn_current_user_has_access_permission('pqr.manage'))
  );
REVOKE ALL ON public.pqr_attachments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.pqr_attachments TO authenticated;

-- ---------------------------------------------------------------------------
-- Storage policies: upload only into a ticket you can access, read only what
-- is registered (and visible) in pqr_attachments. No update/delete.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS pqr_attachments_upload ON storage.objects;
CREATE POLICY pqr_attachments_upload ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'pqr-attachments'
    AND name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg|webp)$'
    AND public.fn_pqr_can_access_ticket((storage.foldername(name))[1])
  );

DROP POLICY IF EXISTS pqr_attachments_read ON storage.objects;
CREATE POLICY pqr_attachments_read ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'pqr-attachments'
    AND EXISTS (SELECT 1 FROM public.pqr_attachments a WHERE a.storage_path = objects.name)
  );

-- ---------------------------------------------------------------------------
-- Register an uploaded file against a ticket
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_pqr_register_attachment(
  p_ticket_id uuid, p_storage_path text, p_file_name text, p_mime_type text, p_size_bytes bigint
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor record;
  v_ticket public.pqr_tickets%ROWTYPE;
  v_event_id uuid;
  v_internal boolean := false;
  v_id uuid;
BEGIN
  SELECT * INTO v_actor FROM public.fn_pqr_actor();
  SELECT * INTO v_ticket FROM public.pqr_tickets WHERE id = p_ticket_id FOR UPDATE;
  IF NOT FOUND OR NOT (public.fn_current_user_has_access_permission('pqr.manage')
      OR (v_ticket.reporter_id = v_actor.user_id AND public.fn_current_user_has_access_permission('pqr.submit'))) THEN
    RAISE EXCEPTION 'Solicitud no encontrada' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_ticket.status IN ('closed', 'rejected') THEN
    RAISE EXCEPTION 'La solicitud está cerrada; no admite más archivos' USING ERRCODE = 'check_violation';
  END IF;
  IF p_storage_path NOT LIKE p_ticket_id::text || '/%' OR p_storage_path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg|webp)$' THEN
    RAISE EXCEPTION 'Ruta de archivo no válida' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'pqr-attachments' AND o.name = p_storage_path) THEN
    RAISE EXCEPTION 'El archivo no se encontró en el almacenamiento' USING ERRCODE = 'no_data_found';
  END IF;
  IF (SELECT count(*) FROM public.pqr_attachments WHERE ticket_id = p_ticket_id) >= 10 THEN
    RAISE EXCEPTION 'Una solicitud admite máximo 10 capturas' USING ERRCODE = 'check_violation';
  END IF;

  SELECT e.id, e.is_internal INTO v_event_id, v_internal
  FROM public.pqr_events e
  WHERE e.ticket_id = p_ticket_id AND e.actor_id = v_actor.user_id AND e.event_type IN ('created', 'comment')
  ORDER BY e.created_at DESC LIMIT 1;

  INSERT INTO public.pqr_attachments (ticket_id, event_id, storage_path, file_name, mime_type, size_bytes, is_internal, uploaded_by)
  VALUES (p_ticket_id, v_event_id, p_storage_path, left(trim(p_file_name), 120), p_mime_type, p_size_bytes,
          coalesce(v_internal, false), v_actor.user_id)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_pqr_register_attachment(uuid, text, text, text, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_pqr_register_attachment(uuid, text, text, text, bigint) TO authenticated;

NOTIFY pgrst, 'reload schema';


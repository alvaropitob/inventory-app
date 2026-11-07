-- Internal PQR (peticiones, quejas, reclamos, anomalias y sugerencias) system.
-- Users report anomalies with the application, support staff track them and the
-- full history (including resolution date) is kept in an append-only timeline.
-- All writes go through permission-checked SECURITY DEFINER functions.

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------
INSERT INTO public.access_permissions (code, module, action, label, description, is_sensitive) VALUES
  ('pqr.submit', 'pqr', 'submit', 'Reportar PQR internas', 'Crear solicitudes y consultar el seguimiento de las propias.', false),
  ('pqr.manage', 'pqr', 'manage', 'Gestionar PQR internas', 'Ver todas las PQR, asignarlas, cambiar su estado y registrar la solución.', true)
ON CONFLICT (code) DO NOTHING;

-- Every active role can report; supervisors and admins can manage.
INSERT INTO public.access_role_permissions (role_id, permission_code)
SELECT r.id, 'pqr.submit' FROM public.roles r WHERE r.is_active
ON CONFLICT DO NOTHING;

INSERT INTO public.access_role_permissions (role_id, permission_code)
SELECT r.id, 'pqr.manage' FROM public.roles r WHERE r.name IN ('admin', 'supervisor')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pqr_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  ticket_type text NOT NULL DEFAULT 'anomalia'
    CHECK (ticket_type IN ('anomalia', 'peticion', 'queja', 'reclamo', 'sugerencia')),
  module text NOT NULL DEFAULT 'Otro' CHECK (char_length(module) BETWEEN 1 AND 80),
  title text NOT NULL CHECK (char_length(title) BETWEEN 5 AND 160),
  description text NOT NULL CHECK (char_length(description) BETWEEN 10 AND 4000),
  context_url text CHECK (context_url IS NULL OR char_length(context_url) <= 500),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_review', 'in_progress', 'waiting_user', 'resolved', 'rejected', 'closed')),
  reporter_id uuid NOT NULL REFERENCES public.users(id),
  reporter_name text NOT NULL,
  assigned_to uuid REFERENCES public.users(id),
  assigned_name text,
  resolution text CHECK (resolution IS NULL OR char_length(resolution) <= 4000),
  reopen_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  closed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_pqr_tickets_reporter ON public.pqr_tickets (reporter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pqr_tickets_status ON public.pqr_tickets (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pqr_tickets_assigned ON public.pqr_tickets (assigned_to) WHERE assigned_to IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.pqr_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.pqr_tickets(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES public.users(id),
  actor_name text NOT NULL,
  event_type text NOT NULL
    CHECK (event_type IN ('created', 'comment', 'status_change', 'assignment', 'priority_change', 'reopened')),
  from_value text,
  to_value text,
  comment text CHECK (comment IS NULL OR char_length(comment) <= 4000),
  is_internal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pqr_events_ticket ON public.pqr_events (ticket_id, created_at);

-- ---------------------------------------------------------------------------
-- Row level security: read-only through the API
-- ---------------------------------------------------------------------------
ALTER TABLE public.pqr_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pqr_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pqr_tickets_select ON public.pqr_tickets;
CREATE POLICY pqr_tickets_select ON public.pqr_tickets FOR SELECT TO authenticated
  USING (
    public.fn_current_user_has_access_permission('pqr.manage')
    OR (reporter_id = auth.uid() AND public.fn_current_user_has_access_permission('pqr.submit'))
  );

DROP POLICY IF EXISTS pqr_events_select ON public.pqr_events;
CREATE POLICY pqr_events_select ON public.pqr_events FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.pqr_tickets t WHERE t.id = pqr_events.ticket_id)
    AND (NOT is_internal OR public.fn_current_user_has_access_permission('pqr.manage'))
  );

REVOKE ALL ON public.pqr_tickets, public.pqr_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.pqr_tickets, public.pqr_events TO authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_pqr_actor()
RETURNS TABLE(user_id uuid, full_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid;
  v_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT u.id, COALESCE(NULLIF(trim(u.full_name), ''), u.username, 'Usuario')
  INTO v_id, v_name
  FROM public.users u
  WHERE u.id = auth.uid() AND u.is_active IS TRUE;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Usuario inactivo o sin perfil autorizado' USING ERRCODE = 'insufficient_privilege';
  END IF;
  user_id := v_id;
  full_name := v_name;
  RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_pqr_actor() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Create a ticket
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_pqr_create(
  p_type text, p_module text, p_title text, p_description text,
  p_priority text, p_context_url text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor record;
  v_id uuid;
BEGIN
  SELECT * INTO v_actor FROM public.fn_pqr_actor();
  IF NOT public.fn_current_user_has_access_permission('pqr.submit') THEN
    RAISE EXCEPTION 'No tienes permiso para reportar PQR' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_type NOT IN ('anomalia', 'peticion', 'queja', 'reclamo', 'sugerencia') THEN
    RAISE EXCEPTION 'Tipo de solicitud no válido' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_priority NOT IN ('low', 'medium', 'high', 'critical') THEN
    RAISE EXCEPTION 'Prioridad no válida' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF char_length(trim(coalesce(p_title, ''))) < 5 THEN
    RAISE EXCEPTION 'El asunto debe tener al menos 5 caracteres' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF char_length(trim(coalesce(p_description, ''))) < 10 THEN
    RAISE EXCEPTION 'La descripción debe tener al menos 10 caracteres' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  INSERT INTO public.pqr_tickets (ticket_type, module, title, description, context_url, priority, reporter_id, reporter_name)
  VALUES (p_type, coalesce(nullif(trim(p_module), ''), 'Otro'), trim(p_title), trim(p_description),
          nullif(trim(coalesce(p_context_url, '')), ''), p_priority, v_actor.user_id, v_actor.full_name)
  RETURNING id INTO v_id;

  INSERT INTO public.pqr_events (ticket_id, actor_id, actor_name, event_type, to_value)
  VALUES (v_id, v_actor.user_id, v_actor.full_name, 'created', 'open');

  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Comment on a ticket
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_pqr_add_comment(
  p_ticket_id uuid, p_comment text, p_is_internal boolean DEFAULT false
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor record;
  v_ticket public.pqr_tickets%ROWTYPE;
  v_is_manager boolean;
BEGIN
  SELECT * INTO v_actor FROM public.fn_pqr_actor();
  v_is_manager := public.fn_current_user_has_access_permission('pqr.manage');

  SELECT * INTO v_ticket FROM public.pqr_tickets WHERE id = p_ticket_id FOR UPDATE;
  IF NOT FOUND OR NOT (v_is_manager OR (v_ticket.reporter_id = v_actor.user_id
      AND public.fn_current_user_has_access_permission('pqr.submit'))) THEN
    RAISE EXCEPTION 'Solicitud no encontrada' USING ERRCODE = 'no_data_found';
  END IF;
  IF char_length(trim(coalesce(p_comment, ''))) < 2 THEN
    RAISE EXCEPTION 'Escribe un comentario' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF coalesce(p_is_internal, false) AND NOT v_is_manager THEN
    RAISE EXCEPTION 'Solo el equipo de soporte puede registrar notas internas' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v_ticket.status IN ('closed', 'rejected') THEN
    RAISE EXCEPTION 'La solicitud está cerrada; no admite más comentarios' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.pqr_events (ticket_id, actor_id, actor_name, event_type, comment, is_internal)
  VALUES (p_ticket_id, v_actor.user_id, v_actor.full_name, 'comment', trim(p_comment), coalesce(p_is_internal, false));

  -- The reporter answering a request for information puts it back in review.
  IF v_ticket.status = 'waiting_user' AND v_ticket.reporter_id = v_actor.user_id AND NOT coalesce(p_is_internal, false) THEN
    UPDATE public.pqr_tickets SET status = 'in_review', updated_at = now() WHERE id = p_ticket_id;
    INSERT INTO public.pqr_events (ticket_id, actor_id, actor_name, event_type, from_value, to_value)
    VALUES (p_ticket_id, v_actor.user_id, v_actor.full_name, 'status_change', 'waiting_user', 'in_review');
  ELSE
    UPDATE public.pqr_tickets SET updated_at = now() WHERE id = p_ticket_id;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Reopen a resolved ticket (reporter or support)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_pqr_reopen(p_ticket_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor record;
  v_ticket public.pqr_tickets%ROWTYPE;
BEGIN
  SELECT * INTO v_actor FROM public.fn_pqr_actor();
  SELECT * INTO v_ticket FROM public.pqr_tickets WHERE id = p_ticket_id FOR UPDATE;
  IF NOT FOUND OR NOT (public.fn_current_user_has_access_permission('pqr.manage')
      OR (v_ticket.reporter_id = v_actor.user_id AND public.fn_current_user_has_access_permission('pqr.submit'))) THEN
    RAISE EXCEPTION 'Solicitud no encontrada' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_ticket.status <> 'resolved' THEN
    RAISE EXCEPTION 'Solo se pueden reabrir solicitudes resueltas' USING ERRCODE = 'check_violation';
  END IF;
  IF char_length(trim(coalesce(p_reason, ''))) < 10 THEN
    RAISE EXCEPTION 'Explica por qué la solución no fue suficiente (mínimo 10 caracteres)' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  UPDATE public.pqr_tickets
  SET status = 'open', resolved_at = NULL, reopen_count = reopen_count + 1, updated_at = now()
  WHERE id = p_ticket_id;

  INSERT INTO public.pqr_events (ticket_id, actor_id, actor_name, event_type, from_value, to_value, comment)
  VALUES (p_ticket_id, v_actor.user_id, v_actor.full_name, 'reopened', 'resolved', 'open', trim(p_reason));
END;
$$;

-- ---------------------------------------------------------------------------
-- Manage a ticket (support): status, priority, assignee and resolution
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_pqr_manage(
  p_ticket_id uuid, p_status text, p_priority text, p_assigned_to uuid,
  p_resolution text DEFAULT NULL, p_comment text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor record;
  v_ticket public.pqr_tickets%ROWTYPE;
  v_assignee_name text;
  v_resolution text;
  v_comment text := nullif(trim(coalesce(p_comment, '')), '');
  v_status_event_has_comment boolean := false;
BEGIN
  SELECT * INTO v_actor FROM public.fn_pqr_actor();
  IF NOT public.fn_current_user_has_access_permission('pqr.manage') THEN
    RAISE EXCEPTION 'No tienes permiso para gestionar PQR' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_status NOT IN ('open', 'in_review', 'in_progress', 'waiting_user', 'resolved', 'rejected', 'closed') THEN
    RAISE EXCEPTION 'Estado no válido' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_priority NOT IN ('low', 'medium', 'high', 'critical') THEN
    RAISE EXCEPTION 'Prioridad no válida' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT * INTO v_ticket FROM public.pqr_tickets WHERE id = p_ticket_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitud no encontrada' USING ERRCODE = 'no_data_found';
  END IF;

  v_resolution := coalesce(nullif(trim(coalesce(p_resolution, '')), ''), v_ticket.resolution);
  IF p_status IN ('resolved', 'rejected', 'closed') AND char_length(coalesce(v_resolution, '')) < 10 THEN
    RAISE EXCEPTION 'Describe la solución, el motivo del rechazo o del cierre (mínimo 10 caracteres)' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_assigned_to IS NOT NULL THEN
    SELECT COALESCE(NULLIF(trim(u.full_name), ''), u.username) INTO v_assignee_name
    FROM public.users u
    WHERE u.id = p_assigned_to AND u.is_active IS TRUE
      AND public.fn_user_has_access_permission(u.id, 'pqr.manage');
    IF v_assignee_name IS NULL THEN
      RAISE EXCEPTION 'El responsable debe ser un usuario activo con permiso para gestionar PQR' USING ERRCODE = 'invalid_parameter_value';
    END IF;
  END IF;

  UPDATE public.pqr_tickets SET
    status = p_status,
    priority = p_priority,
    assigned_to = p_assigned_to,
    assigned_name = v_assignee_name,
    resolution = v_resolution,
    resolved_at = CASE
      WHEN p_status IN ('resolved', 'rejected', 'closed') AND v_ticket.resolved_at IS NULL THEN now()
      WHEN p_status IN ('resolved', 'rejected', 'closed') THEN v_ticket.resolved_at
      ELSE NULL END,
    closed_at = CASE
      WHEN p_status IN ('closed', 'rejected') THEN coalesce(v_ticket.closed_at, now())
      ELSE NULL END,
    updated_at = now()
  WHERE id = p_ticket_id;

  IF p_status IS DISTINCT FROM v_ticket.status THEN
    INSERT INTO public.pqr_events (ticket_id, actor_id, actor_name, event_type, from_value, to_value, comment)
    VALUES (p_ticket_id, v_actor.user_id, v_actor.full_name, 'status_change', v_ticket.status, p_status,
            coalesce(v_comment, CASE WHEN p_status IN ('resolved', 'rejected', 'closed') THEN v_resolution END));
    v_status_event_has_comment := true;
  END IF;

  IF p_priority IS DISTINCT FROM v_ticket.priority THEN
    INSERT INTO public.pqr_events (ticket_id, actor_id, actor_name, event_type, from_value, to_value)
    VALUES (p_ticket_id, v_actor.user_id, v_actor.full_name, 'priority_change', v_ticket.priority, p_priority);
  END IF;

  IF p_assigned_to IS DISTINCT FROM v_ticket.assigned_to THEN
    INSERT INTO public.pqr_events (ticket_id, actor_id, actor_name, event_type, from_value, to_value)
    VALUES (p_ticket_id, v_actor.user_id, v_actor.full_name, 'assignment', v_ticket.assigned_name, v_assignee_name);
  END IF;

  IF v_comment IS NOT NULL AND NOT v_status_event_has_comment THEN
    INSERT INTO public.pqr_events (ticket_id, actor_id, actor_name, event_type, comment)
    VALUES (p_ticket_id, v_actor.user_id, v_actor.full_name, 'comment', v_comment);
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Users that can be assigned as responsible
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_pqr_assignable_users()
RETURNS TABLE(id uuid, full_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT u.id, COALESCE(NULLIF(trim(u.full_name), ''), u.username)
  FROM public.users u
  WHERE public.fn_current_user_has_access_permission('pqr.manage')
    AND u.is_active IS TRUE
    AND public.fn_user_has_access_permission(u.id, 'pqr.manage')
  ORDER BY 2
$$;

REVOKE ALL ON FUNCTION public.fn_pqr_create(text, text, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_pqr_add_comment(uuid, text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_pqr_reopen(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_pqr_manage(uuid, text, text, uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_pqr_assignable_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_pqr_create(text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_pqr_add_comment(uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_pqr_reopen(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_pqr_manage(uuid, text, text, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_pqr_assignable_users() TO authenticated;

NOTIFY pgrst, 'reload schema';

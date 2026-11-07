import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/services/user";
import { hasPermission } from "@/lib/permissions";
import {
  PQR_ATTACHMENT_BUCKET, PQR_PRIORITIES, PQR_STATUSES, PQR_TICKET_COLUMNS, formatPqrDate, formatPqrDuration, isUuid, pqrCode,
  pqrPriority, pqrStatus, pqrTypeLabel, type PqrAttachment, type PqrEvent, type PqrTicket,
} from "@/lib/pqr";
import { addPqrComment, managePqr, reopenPqr } from "../actions";
import PqrSubmitForm from "@/components/PqrSubmitForm";

export const dynamic = "force-dynamic";

function describeEvent(event: PqrEvent): string {
  switch (event.event_type) {
    case "created": return "registró la solicitud";
    case "comment": return event.is_internal ? "dejó una nota interna" : "comentó";
    case "status_change": return `cambió el estado de «${pqrStatus(event.from_value ?? "").label}» a «${pqrStatus(event.to_value ?? "").label}»`;
    case "priority_change": return `cambió la prioridad de «${pqrPriority(event.from_value ?? "").label}» a «${pqrPriority(event.to_value ?? "").label}»`;
    case "assignment": return event.to_value ? `asignó la solicitud a ${event.to_value}` : "quitó el responsable";
    case "reopened": return "reabrió la solicitud";
  }
}

export default async function PqrDetailPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const [{ id }, { error, success }] = await Promise.all([params, searchParams]);
  if (!isUuid(id)) notFound();
  const user = await getCurrentUserProfile();
  if (!user) redirect("/auth/login");
  const canManage = hasPermission(user.permissions, "pqr.manage");
  if (!canManage && !hasPermission(user.permissions, "pqr.submit")) redirect("/dashboard");

  const supabase = await createClient();
  const { data: ticketData } = await supabase.from("pqr_tickets").select(PQR_TICKET_COLUMNS).eq("id", id).maybeSingle();
  if (!ticketData) notFound();
  const ticket = ticketData as PqrTicket;

  const [{ data: eventData }, assignees] = await Promise.all([
    supabase.from("pqr_events")
      .select("id, ticket_id, actor_id, actor_name, event_type, from_value, to_value, comment, is_internal, created_at")
      .eq("ticket_id", id).order("created_at", { ascending: true }),
    canManage ? supabase.rpc("fn_pqr_assignable_users") : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ]);
  const events = (eventData ?? []) as PqrEvent[];
  const assignable = (assignees.data ?? []) as { id: string; full_name: string }[];

  const { data: attachmentData } = await supabase
    .from("pqr_attachments")
    .select("id, ticket_id, event_id, storage_path, file_name, mime_type, size_bytes, is_internal, created_at")
    .eq("ticket_id", id).order("created_at", { ascending: true });
  const attachments = (attachmentData ?? []) as PqrAttachment[];
  const signed = attachments.length
    ? await supabase.storage.from(PQR_ATTACHMENT_BUCKET).createSignedUrls(attachments.map((item) => item.storage_path), 3600)
    : { data: [] as { path: string | null; signedUrl: string }[] };
  const urlByPath = new Map((signed.data ?? []).filter((item) => item.path).map((item) => [item.path as string, item.signedUrl]));
  const attachmentsByEvent = new Map<string, PqrAttachment[]>();
  for (const item of attachments) {
    const key = item.event_id ?? "none";
    attachmentsByEvent.set(key, [...(attachmentsByEvent.get(key) ?? []), item]);
  }
  const renderAttachments = (items: PqrAttachment[] | undefined) => items?.length ? (
    <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap", marginTop: ".5rem" }}>
      {items.map((item) => urlByPath.get(item.storage_path) ? (
        <a key={item.id} href={urlByPath.get(item.storage_path)} target="_blank" rel="noopener noreferrer" title={`Abrir ${item.file_name}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={urlByPath.get(item.storage_path)} alt={`Captura adjunta: ${item.file_name}`} loading="lazy" style={{ width: 150, height: 100, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border)" }} />
        </a>
      ) : <span key={item.id} className="cell-secondary">{item.file_name} (no disponible)</span>)}
    </div>
  ) : null;

  const status = pqrStatus(ticket.status);
  const priority = pqrPriority(ticket.priority);
  const isReporter = ticket.reporter_id === user.id;
  const isFinal = ticket.status === "rejected" || ticket.status === "closed";
  const canComment = !isFinal;
  const canReopen = ticket.status === "resolved" && (isReporter || canManage);
  const finishedAt = ticket.resolved_at;

  return (
    <div className="dashboard-main">
      <div className="page-header">
        <div>
          <p className="cell-secondary" style={{ margin: 0 }}>{pqrCode(ticket.ticket_number)} · {pqrTypeLabel(ticket.ticket_type)}</p>
          <h1 className="page-header-title">{ticket.title}</h1>
          <p style={{ display: "flex", gap: ".5rem", flexWrap: "wrap", marginTop: ".5rem" }}>
            <span className={`pill-badge ${status.pill}`}>{status.label}</span>
            <span className={`pill-badge ${priority.pill}`}>Prioridad {priority.label.toLowerCase()}</span>
            {ticket.reopen_count > 0 && <span className="pill-badge pill-amber">Reabierta {ticket.reopen_count} {ticket.reopen_count === 1 ? "vez" : "veces"}</span>}
          </p>
        </div>
        <Link className="btn-secondary" href="/dashboard/pqr">Volver al listado</Link>
      </div>

      {error && <p className="alert-error" role="alert">{error}</p>}
      {success && <p className="alert-success" role="status">{success}</p>}

      <div style={{ display: "grid", gap: "1.5rem", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", alignItems: "start" }}>
        <div style={{ display: "grid", gap: "1.5rem" }}>
          <section className="table-card">
            <div className="card-section-header"><h2 className="card-section-title">Detalle</h2></div>
            <div style={{ padding: "0 1.25rem 1.25rem" }}>
              <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, margin: 0 }}>{ticket.description}</p>
              <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: ".75rem 1.5rem", margin: "1.25rem 0 0" }}>
                <div><dt className="cell-secondary">Módulo</dt><dd style={{ margin: 0 }}>{ticket.module}</dd></div>
                <div><dt className="cell-secondary">Reportó</dt><dd style={{ margin: 0 }}>{ticket.reporter_name}</dd></div>
                <div><dt className="cell-secondary">Responsable</dt><dd style={{ margin: 0 }}>{ticket.assigned_name ?? "Sin asignar"}</dd></div>
                {ticket.context_url && <div><dt className="cell-secondary">Dónde ocurrió</dt><dd style={{ margin: 0, wordBreak: "break-all" }}>{ticket.context_url}</dd></div>}
              </dl>
            </div>
          </section>

          <section className="table-card" aria-labelledby="pqr-resolution">
            <div className="card-section-header"><h2 className="card-section-title" id="pqr-resolution">Solución</h2></div>
            <div style={{ padding: "0 1.25rem 1.25rem" }}>
              {finishedAt ? (
                <>
                  <p className="alert-success" role="status" style={{ marginTop: 0 }}>
                    {ticket.status === "rejected" ? "Rechazada" : "Solucionada"} el {formatPqrDate(finishedAt)} · tardó {formatPqrDuration(ticket.created_at, finishedAt)}.
                  </p>
                  <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, margin: 0 }}>{ticket.resolution}</p>
                </>
              ) : (
                <p className="cell-secondary" style={{ margin: 0 }}>Aún sin solución. Lleva abierta {formatPqrDuration(ticket.created_at, null)}.</p>
              )}
              {canReopen && (
                <form action={reopenPqr} style={{ display: "grid", gap: ".5rem", marginTop: "1rem" }}>
                  <input type="hidden" name="ticket_id" value={ticket.id} />
                  <label className="form-label">¿La solución no fue suficiente?
                    <textarea className="form-textarea" name="reason" required minLength={10} maxLength={4000} rows={3} placeholder="Explica qué sigue fallando" />
                  </label>
                  <div><button className="btn-secondary" type="submit">Reabrir solicitud</button></div>
                </form>
              )}
            </div>
          </section>

          <section className="table-card" aria-labelledby="pqr-timeline">
            <div className="card-section-header"><h2 className="card-section-title" id="pqr-timeline">Seguimiento</h2></div>
            <ol style={{ listStyle: "none", margin: 0, padding: "0 1.25rem 1.25rem", display: "grid", gap: "1rem" }}>
              {events.map((event) => (
                <li key={event.id} style={{ borderLeft: "3px solid var(--primary)", paddingLeft: ".85rem" }}>
                  <div><strong>{event.actor_name}</strong> {describeEvent(event)}</div>
                  <div className="cell-secondary">{formatPqrDate(event.created_at)}{event.is_internal && " · solo visible para soporte"}</div>
                  {event.comment && <p style={{ whiteSpace: "pre-wrap", margin: ".4rem 0 0", lineHeight: 1.5 }}>{event.comment}</p>}
                  {renderAttachments(attachmentsByEvent.get(event.id))}
                </li>
              ))}
            </ol>
            {canComment && (
              <PqrSubmitForm
                mode="comment" action={addPqrComment} submitLabel="Publicar comentario" pendingLabel="Publicando…"
                style={{ padding: "0 1.25rem 1.25rem" }}
                footer={canManage ? <label className="form-checkbox-label" style={{ marginTop: ".75rem" }}><input type="checkbox" name="is_internal" /> Nota interna (el reportante no la verá)</label> : undefined}
              >
                <input type="hidden" name="ticket_id" value={ticket.id} />
                <label className="form-label">Agregar comentario
                  <textarea className="form-textarea" name="comment" required minLength={2} maxLength={4000} rows={3} />
                </label>
              </PqrSubmitForm>
            )}
          </section>
        </div>

        {canManage && (
          <form action={managePqr} className="form-card">
            <div className="form-card-header"><h2 className="form-card-title">Gestión</h2></div>
            <div className="form-card-body" style={{ display: "grid", gap: ".85rem" }}>
              <input type="hidden" name="ticket_id" value={ticket.id} />
              <label className="form-label">Estado
                <select className="form-select" name="status" defaultValue={ticket.status}>
                  {PQR_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
              <label className="form-label">Prioridad
                <select className="form-select" name="priority" defaultValue={ticket.priority}>
                  {PQR_PRIORITIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
              <label className="form-label">Responsable
                <select className="form-select" name="assigned_to" defaultValue={ticket.assigned_to ?? ""}>
                  <option value="">Sin asignar</option>
                  {assignable.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}
                </select>
              </label>
              <label className="form-label">Solución o motivo del rechazo
                <textarea className="form-textarea" name="resolution" rows={4} maxLength={4000} defaultValue={ticket.resolution ?? ""} placeholder="Obligatoria al marcar como resuelta o rechazada" />
              </label>
              <label className="form-label">Comentario para el reportante (opcional)
                <textarea className="form-textarea" name="comment" rows={3} maxLength={4000} />
              </label>
              <button className="btn-primary" type="submit">Guardar cambios</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}


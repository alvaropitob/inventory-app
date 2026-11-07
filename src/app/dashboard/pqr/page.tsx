import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/services/user";
import { hasPermission } from "@/lib/permissions";
import {
  PQR_PRIORITIES, PQR_TICKET_COLUMNS, PQR_TYPES, formatPqrDate, formatPqrDuration,
  pqrCode, pqrPriority, pqrStatus, pqrTypeLabel, type PqrTicket,
} from "@/lib/pqr";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ state?: string; scope?: string; type?: string; priority?: string; q?: string; page?: string; error?: string }>;
const PAGE_SIZE = 50;

export default async function PqrPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUserProfile();
  if (!user) redirect("/auth/login");
  const canSubmit = hasPermission(user.permissions, "pqr.submit");
  const canManage = hasPermission(user.permissions, "pqr.manage");
  if (!canSubmit && !canManage) redirect("/dashboard");

  const params = await searchParams;
  const state = ["open", "done", "all"].includes(params.state ?? "") ? params.state! : "open";
  const scope = canManage && ["all", "mine", "assigned"].includes(params.scope ?? "") ? params.scope! : canManage ? "all" : "mine";
  const query = (params.q ?? "").trim().slice(0, 80);
  const pageParam = Number.parseInt(params.page ?? "1", 10);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const link = (overrides: Record<string, string>) => {
    const next = new URLSearchParams();
    const merged: Record<string, string> = { state, scope, type: params.type ?? "", priority: params.priority ?? "", q: params.q ?? "", page: "", ...overrides };
    for (const [key, value] of Object.entries(merged)) if (value) next.set(key, value);
    return `/dashboard/pqr?${next.toString()}`;
  };

  const supabase = await createClient();
  let ticketsQuery = supabase
    .from("pqr_tickets")
    .select(PQR_TICKET_COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (scope === "mine") ticketsQuery = ticketsQuery.eq("reporter_id", user.id);
  if (scope === "assigned") ticketsQuery = ticketsQuery.eq("assigned_to", user.id);
  if (state === "open") ticketsQuery = ticketsQuery.in("status", ["open", "in_review", "in_progress", "waiting_user"]);
  if (state === "done") ticketsQuery = ticketsQuery.in("status", ["resolved", "rejected", "closed"]);
  if (params.type && PQR_TYPES.some((item) => item.value === params.type)) ticketsQuery = ticketsQuery.eq("ticket_type", params.type);
  if (params.priority && PQR_PRIORITIES.some((item) => item.value === params.priority)) ticketsQuery = ticketsQuery.eq("priority", params.priority);
  if (query) {
    const safeQuery = query.replace(/[^\p{L}\p{N} ._-]/gu, " ").trim().slice(0, 80);
    if (safeQuery) {
      const clauses = [`title.ilike.%${safeQuery}%`, `reporter_name.ilike.%${safeQuery}%`, `module.ilike.%${safeQuery}%`];
      const ticketNumber = safeQuery.match(/^(?:PQR[- ]?)?(\d+)$/i)?.[1];
      if (ticketNumber) clauses.push(`ticket_number.eq.${Number(ticketNumber)}`);
      ticketsQuery = ticketsQuery.or(clauses.join(","));
    }
  }
  const [{ data, error, count }, { data: metricData, error: metricsError }] = await Promise.all([
    ticketsQuery,
    supabase.rpc("fn_pqr_dashboard_metrics", { p_scope: scope }),
  ]);
  const rows = (data ?? []) as PqrTicket[];
  const totalRows = count ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  if (page > pageCount) redirect(link({ page: String(pageCount) }));
  const metrics = (metricData?.[0] ?? null) as { open_count: number; urgent_open_count: number; unassigned_open_count: number; resolved_count: number; avg_resolution_seconds: number | null } | null;
  const averageLabel = metrics?.avg_resolution_seconds == null
    ? "—"
    : formatPqrDuration(new Date(0).toISOString(), new Date(metrics.avg_resolution_seconds * 1000).toISOString());

  return (
    <div className="dashboard-main">
      <div className="page-header">
        <div>
          <h1 className="page-header-title">PQR internas</h1>
          <p className="page-header-subtitle">Reporta anomalías del programa, haz seguimiento y consulta cuándo fueron solucionadas.</p>
        </div>
        {canSubmit && <Link className="btn-primary" href="/dashboard/pqr/nuevo">Nueva solicitud</Link>}
      </div>

      {(params.error || error) && <p className="alert-error" role="alert">{params.error ?? `No se pudieron cargar las solicitudes: ${error?.message}`}</p>}
      {metricsError && <p className="alert-error" role="alert">No se pudieron cargar los indicadores de PQR: {metricsError.message}</p>}

      <div className="kpi-grid stagger-in" style={{ marginBottom: "1.5rem" }}>
        <div className="kpi-card"><div className="kpi-card-header"><h3 className="kpi-card-label">{scope === "mine" ? "Mis solicitudes abiertas" : scope === "assigned" ? "Abiertas asignadas a mí" : "Abiertas"}</h3></div><div className="kpi-value">{metrics?.open_count ?? "—"}</div></div>
        <div className="kpi-card kpi-accent-warning"><div className="kpi-card-header"><h3 className="kpi-card-label">Prioridad alta o crítica</h3></div><div className="kpi-value">{metrics?.urgent_open_count ?? "—"}</div></div>
        {canManage && <div className="kpi-card"><div className="kpi-card-header"><h3 className="kpi-card-label">Sin responsable</h3></div><div className="kpi-value">{metrics?.unassigned_open_count ?? "—"}</div></div>}
        <div className="kpi-card kpi-accent-success"><div className="kpi-card-header"><h3 className="kpi-card-label">Resueltas</h3></div><div className="kpi-value">{metrics?.resolved_count ?? "—"}</div><p className="cell-secondary">Tiempo medio: {averageLabel}</p></div>
      </div>

      <div className="table-card">
        <div className="card-section-header" style={{ gap: "1rem", flexWrap: "wrap", alignItems: "end" }}>
          <nav aria-label="Estado" style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
            {([["open", "Abiertas"], ["done", "Resueltas / cerradas"], ["all", "Todas"]] as const).map(([value, label]) => (
              <Link key={value} className={state === value ? "btn-primary" : "btn-secondary"} href={link({ state: value })} aria-current={state === value ? "page" : undefined}>{label}</Link>
            ))}
          </nav>
          {canManage && (
            <nav aria-label="Alcance" style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
              {([["all", "Todas"], ["assigned", "Asignadas a mí"], ["mine", "Reportadas por mí"]] as const).map(([value, label]) => (
                <Link key={value} className={scope === value ? "btn-outline" : "btn-secondary"} href={link({ scope: value })}>{label}</Link>
              ))}
            </nav>
          )}
        </div>
        <form method="get" style={{ display: "flex", gap: ".75rem", flexWrap: "wrap", alignItems: "end", padding: "0 1.25rem 1rem" }}>
          <input type="hidden" name="state" value={state} />
          <input type="hidden" name="scope" value={scope} />
          <label className="form-label">Buscar<input className="form-input" name="q" defaultValue={params.q ?? ""} placeholder="Código, asunto o persona" maxLength={80} /></label>
          <label className="form-label">Tipo<select className="form-select" name="type" defaultValue={params.type ?? ""}><option value="">Todos</option>{PQR_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label className="form-label">Prioridad<select className="form-select" name="priority" defaultValue={params.priority ?? ""}><option value="">Todas</option>{PQR_PRIORITIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <button className="btn-secondary" type="submit">Filtrar</button>
        </form>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr><th>Código</th><th>Asunto</th><th>Tipo</th><th>Módulo</th><th>Prioridad</th><th>Estado</th>{canManage && <th>Reportó</th>}<th>Responsable</th><th>Creada</th><th>Solución</th></tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={canManage ? 10 : 9} className="cell-secondary" style={{ textAlign: "center", padding: "2rem" }}>No hay solicitudes con estos filtros.</td></tr>}
              {rows.map((ticket) => {
                const status = pqrStatus(ticket.status);
                const priority = pqrPriority(ticket.priority);
                return (
                  <tr key={ticket.id}>
                    <td><Link href={`/dashboard/pqr/${ticket.id}`} style={{ color: "var(--primary)", fontWeight: 600 }}>{pqrCode(ticket.ticket_number)}</Link></td>
                    <td style={{ minWidth: "220px", maxWidth: "360px" }}><Link href={`/dashboard/pqr/${ticket.id}`}>{ticket.title}</Link></td>
                    <td>{pqrTypeLabel(ticket.ticket_type)}</td>
                    <td>{ticket.module}</td>
                    <td><span className={`pill-badge ${priority.pill}`}>{priority.label}</span></td>
                    <td><span className={`pill-badge ${status.pill}`}>{status.label}</span></td>
                    {canManage && <td>{ticket.reporter_name}</td>}
                    <td>{ticket.assigned_name ?? <span className="cell-secondary">Sin asignar</span>}</td>
                    <td>{formatPqrDate(ticket.created_at)}</td>
                    <td>{ticket.resolved_at ? <><div>{formatPqrDate(ticket.resolved_at)}</div><div className="cell-secondary">en {formatPqrDuration(ticket.created_at, ticket.resolved_at)}</div></> : <span className="cell-secondary">Pendiente · {formatPqrDuration(ticket.created_at, null)}</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="access-editor-footer" style={{ justifyContent: "space-between", alignItems: "center", padding: "1rem 1.25rem" }}>
          <span className="cell-secondary">{totalRows ? `Mostrando ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, totalRows)} de ${totalRows}` : "0 solicitudes"}</span>
          <nav aria-label="Paginación de solicitudes" style={{ display: "flex", gap: ".5rem", alignItems: "center" }}>
            {page > 1 && <Link className="btn-secondary" href={link({ page: String(page - 1) })}>Anterior</Link>}
            <span className="cell-secondary">Página {page} de {pageCount}</span>
            {page < pageCount && <Link className="btn-secondary" href={link({ page: String(page + 1) })}>Siguiente</Link>}
          </nav>
        </div>
      </div>
    </div>
  );
}


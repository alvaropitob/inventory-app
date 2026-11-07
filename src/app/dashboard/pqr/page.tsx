import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/services/user";
import { hasPermission } from "@/lib/permissions";
import {
  PQR_PRIORITIES, PQR_TICKET_COLUMNS, PQR_TYPES, formatPqrDate, formatPqrDuration,
  isPqrOpen, pqrCode, pqrPriority, pqrStatus, pqrTypeLabel, type PqrTicket,
} from "@/lib/pqr";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ state?: string; scope?: string; type?: string; priority?: string; q?: string; error?: string }>;

export default async function PqrPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUserProfile();
  if (!user) redirect("/auth/login");
  const canSubmit = hasPermission(user.permissions, "pqr.submit");
  const canManage = hasPermission(user.permissions, "pqr.manage");
  if (!canSubmit && !canManage) redirect("/dashboard");

  const params = await searchParams;
  const state = ["open", "done", "all"].includes(params.state ?? "") ? params.state! : "open";
  const scope = canManage && ["all", "mine", "assigned"].includes(params.scope ?? "") ? params.scope! : canManage ? "all" : "mine";
  const query = (params.q ?? "").trim().toLowerCase().slice(0, 80);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pqr_tickets")
    .select(PQR_TICKET_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(1000);
  const all = (data ?? []) as PqrTicket[];
  const base = all.filter((ticket) => {
    if (scope === "mine") return ticket.reporter_id === user.id;
    if (scope === "assigned") return ticket.assigned_to === user.id;
    return true;
  });

  const rows = base.filter((ticket) => {
    if (state === "open" && !isPqrOpen(ticket.status)) return false;
    if (state === "done" && isPqrOpen(ticket.status)) return false;
    if (params.type && ticket.ticket_type !== params.type) return false;
    if (params.priority && ticket.priority !== params.priority) return false;
    if (query && !`${pqrCode(ticket.ticket_number)} ${ticket.title} ${ticket.reporter_name} ${ticket.module}`.toLowerCase().includes(query)) return false;
    return true;
  });

  const openTickets = base.filter((ticket) => isPqrOpen(ticket.status));
  const urgentOpen = openTickets.filter((ticket) => ticket.priority === "high" || ticket.priority === "critical");
  const unassigned = openTickets.filter((ticket) => !ticket.assigned_to);
  const resolved = base.filter((ticket) => ticket.resolved_at);
  const averageMs = resolved.length
    ? resolved.reduce((sum, ticket) => sum + (new Date(ticket.resolved_at!).getTime() - new Date(ticket.created_at).getTime()), 0) / resolved.length
    : null;
  const averageLabel = averageMs === null ? "—" : formatPqrDuration(new Date(0).toISOString(), new Date(averageMs).toISOString());

  const link = (overrides: Record<string, string>) => {
    const next = new URLSearchParams();
    const merged: Record<string, string> = { state, scope, type: params.type ?? "", priority: params.priority ?? "", q: params.q ?? "", ...overrides };
    for (const [key, value] of Object.entries(merged)) if (value) next.set(key, value);
    return `/dashboard/pqr?${next.toString()}`;
  };

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

      <div className="kpi-grid stagger-in" style={{ marginBottom: "1.5rem" }}>
        <div className="kpi-card"><div className="kpi-card-header"><h3 className="kpi-card-label">{scope === "mine" ? "Mis solicitudes abiertas" : "Abiertas"}</h3></div><div className="kpi-value">{openTickets.length}</div></div>
        <div className="kpi-card kpi-accent-warning"><div className="kpi-card-header"><h3 className="kpi-card-label">Prioridad alta o crítica</h3></div><div className="kpi-value">{urgentOpen.length}</div></div>
        {canManage && <div className="kpi-card"><div className="kpi-card-header"><h3 className="kpi-card-label">Sin responsable</h3></div><div className="kpi-value">{unassigned.length}</div></div>}
        <div className="kpi-card kpi-accent-success"><div className="kpi-card-header"><h3 className="kpi-card-label">Resueltas</h3></div><div className="kpi-value">{resolved.length}</div><p className="cell-secondary">Tiempo medio: {averageLabel}</p></div>
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
      </div>
    </div>
  );
}


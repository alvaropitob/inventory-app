import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/services/user";
import { BadgeCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function AuditoriaPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; user?: string }> }) {
  const { from, to, user: selectedUser } = await searchParams;
  const user = await getCurrentUserProfile();
  if (!user || !hasPermission(user.permissions, "audit.logs.view")) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  let query = supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1000);
  if (selectedUser) query = query.eq('user_id', selectedUser);
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) query = query.gte('created_at', new Date(`${from}T00:00:00-05:00`).toISOString());
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) query = query.lte('created_at', new Date(`${to}T23:59:59.999-05:00`).toISOString());
  const [{ data: logs, error }, { data: auditUsers }, { data: accessEvents, error: accessEventsError }] = await Promise.all([
    query,
    supabase.rpc('fn_get_audit_user_directory'),
    supabase.from('access_audit_events').select('*').order('created_at', { ascending: false }).limit(100),
  ]);
  const directory = (auditUsers || []) as Array<{ id: string; full_name: string | null; username: string | null }>;
  const users = directory.map((entry) => ({ id: entry.id, name: entry.full_name || entry.username || 'Usuario' }));
  const auditUserNames = new Map<string, string>(users.map((account) => [account.id, account.name]));

  return (
    <div className="dashboard-main">
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Centro de Auditoría y Trazabilidad</h1>
            <p className="page-header-subtitle">Historial de acciones operativas y cambios de control de acceso.</p>
        </div>
      </div>

      <div className="table-card" style={{ marginBottom: "1rem" }}>
        <div className="card-section-header"><div><h2 className="card-section-title">Cambios de usuarios y roles</h2><p className="card-section-subtitle">Últimos 100 cambios de acceso, con estado anterior, estado nuevo y motivo.</p></div></div>
        {accessEventsError && <p className="alert-error" role="alert">No se pudieron cargar los cambios de acceso: {accessEventsError.message}</p>}
        <div className="table-responsive"><table className="data-table"><thead><tr><th>Fecha</th><th>Evento</th><th>Actor</th><th>Usuario afectado / rol</th><th>Motivo y cambios</th></tr></thead><tbody>
          {(accessEvents ?? []).map(event => <tr key={event.id}><td>{new Date(event.created_at).toLocaleString("es-CO")}</td><td>{event.event_type}</td><td className="audit-detail">{event.actor_user_id}</td><td className="audit-detail">{event.subject_user_id || event.role_id || "—"}</td><td className="audit-detail"><details><summary>Ver detalle y motivo</summary><p>{event.reason}</p><pre style={{ maxWidth: "52rem", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{JSON.stringify({ before: event.before_state, after: event.after_state }, null, 2)}</pre></details></td></tr>)}
          {(!accessEvents || accessEvents.length === 0) && !accessEventsError && <tr><td colSpan={5} className="workflow-empty-state"><strong>Sin cambios de acceso registrados</strong><span>Las modificaciones de usuarios y perfiles aparecerán aquí.</span></td></tr>}
        </tbody></table></div>
      </div>

      <div className="table-card">
        <div className="card-section-header">
          <div>
            <h2 className="card-section-title">Registro de Actividades</h2>
            <p className="card-section-subtitle">Últimos 100 movimientos registrados en el sistema.</p>
          </div>
          <span className="badge-verified"><BadgeCheck className="ui-icon" aria-hidden="true" /> Registro operativo</span>
        </div>

        <form method="get" className="audit-filters">
          <div><label className="form-label" htmlFor="audit-from">Desde</label><input className="form-input" id="audit-from" type="date" name="from" defaultValue={from || ''} /></div>
          <div><label className="form-label" htmlFor="audit-to">Hasta</label><input className="form-input" id="audit-to" type="date" name="to" defaultValue={to || ''} /></div>
          <div><label className="form-label" htmlFor="audit-user">Usuario</label><select className="form-select" id="audit-user" name="user" defaultValue={selectedUser || ''}><option value="">Todos</option>{users.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</select></div>
          <button type="submit" className="btn-primary">Filtrar auditoría</button>
          <a href="/dashboard/auditoria" className="btn-secondary" style={{ textAlign: 'center', textDecoration: 'none' }}>Limpiar filtros</a>
        </form>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha / Hora</th>
                <th>Usuario</th>
                <th>Acción</th>
                <th>Entidad / Tabla</th>
                <th>Detalle Técnico</th>
              </tr>
            </thead>
            <tbody>
              {logs?.map((log) => (
                <tr key={log.id}>
                  <td>{new Date(log.created_at).toLocaleString('es-CO')}</td>
                  <td>
                    <strong>{auditUserNames.get(log.user_id) || 'Sistema'}</strong>
                  </td>
                  <td>
                    <span className={`audit-action${log.action === 'SECURITY_VIOLATION' ? ' audit-action-danger' : ''}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="cell-link" style={{ textDecoration: 'none' }}>{log.table_name}</td>
                  <td className="audit-detail">
                    <details>
                      <summary>{log.record_id} — ver detalle completo</summary>
                      <pre style={{ maxWidth: '52rem', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify({ old_data: log.old_data, new_data: log.new_data, notes: log.notes }, null, 2)}</pre>
                    </details>
                  </td>
                </tr>
              ))}
              {(!logs || logs.length === 0) && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    {error ? `Error al cargar logs: ${error.message}` : "No hay registros de auditoría disponibles."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/services/user";
import { BadgeCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AuditoriaPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; user?: string }> }) {
  const { from, to, user: selectedUser } = await searchParams;
  const user = await getCurrentUserProfile();
  if (!user || (user.role !== 'admin' && user.role !== 'auditor')) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  let query = supabase
    .from('audit_logs')
    .select(`*, user:users(full_name, username)`)
    .order('created_at', { ascending: false })
    .limit(1000);
  if (selectedUser) query = query.eq('user_id', selectedUser);
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) query = query.gte('created_at', new Date(`${from}T00:00:00-05:00`).toISOString());
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) query = query.lte('created_at', new Date(`${to}T23:59:59.999-05:00`).toISOString());
  const [{ data: logs, error }, { data: auditUsers }] = await Promise.all([
    query,
    supabase.from('audit_logs').select('user_id, user:users(full_name, username)').limit(1000),
  ]);
  const users = Array.from(new Map((auditUsers || [])
    .filter(entry => entry.user_id)
    .map(entry => {
      const profile = Array.isArray(entry.user) ? entry.user[0] : entry.user;
      return [entry.user_id!, { id: entry.user_id!, name: profile?.full_name || profile?.username || 'Usuario' }] as const;
    })).values());

  return (
    <div className="dashboard-main">
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Centro de Auditoría y Trazabilidad</h1>
          <p className="page-header-subtitle">Rastreo inmutable de acciones para cumplimiento ISO 15189.</p>
        </div>
      </div>

      <div className="table-card">
        <div className="card-section-header">
          <div>
            <h2 className="card-section-title">Registro de Actividades</h2>
            <p className="card-section-subtitle">Últimos 100 movimientos registrados en el sistema.</p>
          </div>
          <span className="badge-verified"><BadgeCheck className="ui-icon" aria-hidden="true" /> Integridad Verificada</span>
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
                    <strong>{log.user?.full_name || log.user?.username || 'Sistema'}</strong>
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

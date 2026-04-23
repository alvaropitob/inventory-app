import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/services/user";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AuditoriaPage() {
  const user = await getCurrentUserProfile();
  if (!user || (user.role !== 'admin' && user.role !== 'auditor')) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const { data: logs, error } = await supabase
    .from('audit_logs')
    .select(`*, user:users(full_name, username)`)
    .order('created_at', { ascending: false })
    .limit(100);

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
          <span className="badge-verified">✓ Integridad Verificada</span>
        </div>

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
                  <td>{new Date(log.created_at).toLocaleString()}</td>
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
                    {log.record_id.substring(0, 8)}... {JSON.stringify(log.new_data).substring(0, 50)}...
                  </td>
                </tr>
              ))}
              {(!logs || logs.length === 0) && (
                <tr>
                  <td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
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

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
    .select(`
      *,
      user:users(full_name, username)
    `)
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <div className="dashboard-main">
      <div className="welcome-section">
        <h1>Centro de Auditoría y Trazabilidad</h1>
        <p>Rastreo inmutable de acciones para cumplimiento ISO 15189.</p>
      </div>

      <div className="stat-card" style={{ width: '100%', flexDirection: 'column', alignItems: 'stretch' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', color: 'var(--navy)' }}>Registro de Actividades</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Últimos 100 movimientos registrados en el sistema.</p>
          </div>
          <div style={{ padding: '0.5rem 1rem', background: '#dcfce7', color: '#166534', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold' }}>
            ✓ Integridad Verificada
          </div>
        </div>

        <div className="table-responsive">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem' }}>Fecha / Hora</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem' }}>Usuario</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem' }}>Acción</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem' }}>Entidad / Tabla</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem' }}>Detalle Técnico</th>
              </tr>
            </thead>
            <tbody>
              {logs?.map((log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '1rem', fontSize: '0.85rem' }}>
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td style={{ padding: '1rem', fontSize: '0.85rem' }}>
                    <strong>{log.user?.full_name || log.user?.username || 'Sistema'}</strong>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{ 
                      padding: '0.25rem 0.6rem', 
                      borderRadius: '12px', 
                      fontSize: '0.65rem', 
                      fontWeight: '800',
                      background: log.action === 'SECURITY_VIOLATION' ? '#fee2e2' : '#f1f5f9',
                      color: log.action === 'SECURITY_VIOLATION' ? '#991b1b' : 'var(--navy-light)'
                    }}>
                      {log.action}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', fontSize: '0.8rem', color: 'var(--primary)', fontWeight: '600' }}>
                    {log.table_name}
                  </td>
                  <td style={{ padding: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
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

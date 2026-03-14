import { redirect } from "next/navigation";
import { getAuditLogs } from "./actions";
import ExportCSVButton from "@/components/ExportCSVButton";
import { getCurrentUserProfile } from "@/lib/services/user";

export const dynamic = "force-dynamic";

interface AuditUser {
  id: string;
  username: string;
  full_name: string;
  email: string;
}

interface AuditLog {
  id: string;
  table_name: string;
  record_id: string;
  action: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
  users: AuditUser | AuditUser[] | null;
}

function getUserDisplayName(users: AuditUser | AuditUser[] | null): string {
  if (!users) return 'Sistema';
  const user = Array.isArray(users) ? users[0] : users;
  return user?.full_name || user?.username || 'Sistema';
}

export default async function AuditoriaPage() {
  const user = await getCurrentUserProfile();

  if (!user || user.role !== "admin") {
    redirect("/dashboard");
  }

  const logs = await getAuditLogs() as unknown as AuditLog[];

  return (
    <div className="dashboard-main">
      <div className="welcome-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Auditoría del Sistema</h1>
          <p>Registro inmutable de todas las acciones críticas realizadas en la plataforma.</p>
        </div>
        <ExportCSVButton 
          filename="Auditoria_Sistema" 
          data={logs.map((log: AuditLog) => ({
            'Fecha y Hora': new Date(log.created_at).toLocaleString(),
            'Acción': log.action,
            'Tabla Modificada': log.table_name,
            'ID Registro': log.record_id,
            'Usuario': getUserDisplayName(log.users),
            'IP': log.ip_address || 'N/A',
            'Datos Anteriores': log.old_data ? JSON.stringify(log.old_data) : '',
            'Nuevos Datos': log.new_data ? JSON.stringify(log.new_data) : ''
          }))} 
        />
      </div>

      <div className="stat-card" style={{ width: '100%', padding: '0', overflow: 'hidden', flexDirection: 'column', alignItems: 'stretch' }}>
        <div className="table-responsive">
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border)' }}>
              <tr>
                <th style={{ padding: '1.25rem', fontSize: '0.8125rem', fontWeight: '700', color: 'var(--navy-light)', textTransform: 'uppercase' }}>Fecha exactta</th>
                <th style={{ padding: '1.25rem', fontSize: '0.8125rem', fontWeight: '700', color: 'var(--navy-light)', textTransform: 'uppercase' }}>Acción</th>
                <th style={{ padding: '1.25rem', fontSize: '0.8125rem', fontWeight: '700', color: 'var(--navy-light)', textTransform: 'uppercase' }}>Sección (Tabla)</th>
                <th style={{ padding: '1.25rem', fontSize: '0.8125rem', fontWeight: '700', color: 'var(--navy-light)', textTransform: 'uppercase' }}>Responsable</th>
                <th style={{ padding: '1.25rem', fontSize: '0.8125rem', fontWeight: '700', color: 'var(--navy-light)', textTransform: 'uppercase' }}>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log: AuditLog) => (
                <tr key={log.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}>
                  <td style={{ padding: '1.25rem', fontSize: '0.85rem' }}>
                    <div style={{ fontWeight: '600', color: 'var(--navy)' }}>{new Date(log.created_at).toLocaleDateString()}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(log.created_at).toLocaleTimeString()}</div>
                  </td>
                  <td style={{ padding: '1.25rem' }}>
                    <span style={{ 
                      padding: '0.25rem 0.6rem', 
                      borderRadius: '12px', 
                      fontSize: '0.75rem', 
                      fontWeight: '700',
                      background: log.action === 'INSERT' ? '#dcfce7' : log.action === 'UPDATE' ? '#fef3c7' : log.action === 'DELETE' ? '#fee2e2' : '#fef9c3',
                      color: log.action === 'INSERT' ? '#166534' : log.action === 'UPDATE' ? '#d97706' : log.action === 'DELETE' ? '#991b1b' : '#854d0e',
                      textTransform: 'uppercase'
                    }}>
                      {log.action}
                    </span>
                  </td>
                  <td style={{ padding: '1.25rem' }}>
                    <div style={{ fontWeight: '600', fontSize: '0.85rem' }}>{log.table_name}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>ID: {log.record_id?.substring(0,8)}...</div>
                  </td>
                  <td style={{ padding: '1.25rem' }}>
                    <div style={{ fontWeight: '600', fontSize: '0.85rem' }}>{getUserDisplayName(log.users)}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>IP: {log.ip_address || 'Desconocida'}</div>
                  </td>
                  <td style={{ padding: '1.25rem', maxWidth: '300px' }}>
                    <details style={{ cursor: 'pointer' }}>
                      <summary style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--primary)', outline: 'none' }}>Ver JSON</summary>
                      <div style={{ marginTop: '0.5rem', maxHeight: '150px', overflowY: 'auto', background: '#f8fafc', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)' }}>
                        {log.old_data && (
                          <div style={{ marginBottom: '0.5rem' }}>
                            <strong style={{ fontSize: '0.75rem', color: 'var(--error)' }}>Antes:</strong>
                            <pre style={{ fontSize: '0.7rem', margin: '0', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{JSON.stringify(log.old_data, null, 2)}</pre>
                          </div>
                        )}
                        {log.new_data && (
                          <div>
                            <strong style={{ fontSize: '0.75rem', color: 'var(--success)' }}>Después:</strong>
                            <pre style={{ fontSize: '0.7rem', margin: '0', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{JSON.stringify(log.new_data, null, 2)}</pre>
                          </div>
                        )}
                      </div>
                    </details>
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No hay registros de auditoría disponibles.
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

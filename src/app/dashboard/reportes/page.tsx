import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/services/user";
import { ComplianceService } from "@/lib/services/compliance";
import { StockService } from "@/lib/services/stock";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ type?: string }>;
}

export default async function ReportesPage({ searchParams }: PageProps) {
  const user = await getCurrentUserProfile();
  if (!user) {
    redirect("/auth/login");
  }

  const { type = 'resumen' } = await searchParams;

  const [incidents, logs, movementsResponse] = await Promise.all([
    ComplianceService.getSafetyIncidents(),
    ComplianceService.getEnvironmentalLogs(100),
    StockService.getAllMovements(),
  ]);

  const movements = (movementsResponse.data as {
    id: string; movement_type: string; reason?: string | null;
    created_at: string; quantity: number;
    batch?: { batch_number: string; item?: { technical_name: string } };
  }[]) || [];

  const mermas = movements.filter(m =>
    m.movement_type === 'exit' &&
    (m.reason?.toLowerCase().includes('vencid') ||
     m.reason?.toLowerCase().includes('dañ') ||
     m.reason?.toLowerCase().includes('falla') ||
     m.reason?.toLowerCase().includes('merma'))
  );

  const navItems = [
    { key: 'resumen',           label: '📊 Resumen Normativo'  },
    { key: 'reactivovigilancia', label: '🛡️ Reactivovigilancia' },
    { key: 'mermas',            label: '📉 Mermas y Bajas'      },
    { key: 'ambiental',         label: '🌡️ Historial Ambiental' },
  ];

  return (
    <div className="dashboard-main">
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Reportes de Habilitación</h1>
          <p className="page-header-subtitle">Consolidados técnicos para cumplimiento de Resolución 3100 e ISO 15189.</p>
        </div>
      </div>

      <div className="report-layout">
        <div className="report-nav">
          <h2 className="report-nav-title">Tipos de Reporte</h2>
          <nav className="report-nav-body">
            {navItems.map(item => (
              <a
                key={item.key}
                href={`?type=${item.key}`}
                className={`report-nav-item${type === item.key ? ' report-nav-item-active' : ''}`}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="table-card">
          {type === 'resumen' && (
            <div className="form-card-body">
              <h2 className="card-section-title" style={{ marginBottom: '1.5rem' }}>Estado de Cumplimiento Técnico</h2>
              <div className="mini-kpi-grid">
                <div className="mini-kpi-card">
                  <p className="mini-kpi-label">Incidentes Totales</p>
                  <div className="mini-kpi-value" style={{ color: incidents.length > 0 ? 'var(--error)' : 'var(--success)' }}>
                    {incidents.length}
                  </div>
                  <p className="mini-kpi-meta">Eventos de reactivovigilancia</p>
                </div>
                <div className="mini-kpi-card">
                  <p className="mini-kpi-label">Mermas / Bajas</p>
                  <div className="mini-kpi-value" style={{ color: 'var(--navy)' }}>{mermas.length}</div>
                  <p className="mini-kpi-meta">Descartes registrados</p>
                </div>
                <div className="mini-kpi-card">
                  <p className="mini-kpi-label">Registros Ambientales</p>
                  <div className="mini-kpi-value" style={{ color: 'var(--primary)' }}>{logs.length}</div>
                  <p className="mini-kpi-meta">Lecturas térmicas</p>
                </div>
              </div>

              <div className="normative-box">
                <h3>Sugerencia Normativa</h3>
                <p>
                  Para las visitas de habilitación (Res. 3100), asegúrese de tener impresos o disponibles
                  digitalmente los reportes de <b>Reactivovigilancia</b> del último año. El historial de{' '}
                  <b>Monitoreo Ambiental</b> debe contar con al menos 2 registros diarios por ubicación de red de frío.
                </p>
              </div>
            </div>
          )}

          {type === 'reactivovigilancia' && (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Lote</th>
                    <th>Acciones Correctivas</th>
                  </tr>
                </thead>
                <tbody>
                  {incidents.map(inc => (
                    <tr key={inc.id}>
                      <td>{new Date(inc.reported_at).toLocaleDateString()}</td>
                      <td className="cell-primary">{inc.incident_type}</td>
                      <td>{inc.batch?.batch_number}</td>
                      <td>{inc.action_taken || 'Pendiente'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {type === 'ambiental' && (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha y Hora</th>
                    <th>Ubicación</th>
                    <th className="cell-center">Temp (°C)</th>
                    <th className="cell-center">Humedad (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id}>
                      <td>{new Date(log.created_at).toLocaleString()}</td>
                      <td>{log.locations?.name}</td>
                      <td className="cell-center" style={{ fontWeight: 700 }}>{log.temperature}</td>
                      <td className="cell-center">{log.humidity || '--'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {type === 'mermas' && (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Producto</th>
                    <th className="cell-center">Cant</th>
                    <th>Motivo / Justificación</th>
                  </tr>
                </thead>
                <tbody>
                  {mermas.map(m => (
                    <tr key={m.id}>
                      <td>{new Date(m.created_at).toLocaleDateString()}</td>
                      <td>{m.batch?.item?.technical_name}</td>
                      <td className="cell-center qty-exit">-{m.quantity}</td>
                      <td>{m.reason}</td>
                    </tr>
                  ))}
                  {mermas.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No hay reportes de mermas registrados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

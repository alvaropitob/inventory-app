import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/services/user";
import { ComplianceService } from "@/lib/services/compliance";

export const dynamic = "force-dynamic";

function IncidentTypeBadge({ type }: { type: string }) {
  const cls =
    type === 'recall'         ? 'pill-red'    :
    type === 'adverse_event'  ? 'pill-orange' :
    'pill-slate';
  return <span className={`pill-badge ${cls}`}>{type}</span>;
}

export default async function SeguridadPage() {
  const user = await getCurrentUserProfile();
  if (!user) {
    redirect("/auth/login");
  }

  const incidents = await ComplianceService.getSafetyIncidents();

  return (
    <div className="dashboard-main">
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Seguridad Clínica</h1>
          <p className="page-header-subtitle">Monitoreo de Reactivovigilancia e incidentes de calidad.</p>
        </div>
      </div>

      <div className="table-card">
        <div className="card-section-header">
          <h2 className="card-section-title">Reportes de Incidentes y Recalls</h2>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Producto / Lote</th>
                <th>Descripción</th>
                <th>Acciones Tomadas</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((incident) => (
                <tr key={incident.id} style={{ background: incident.incident_type === 'recall' ? '#fff1f2' : 'transparent' }}>
                  <td>{new Date(incident.reported_at).toLocaleDateString()}</td>
                  <td><IncidentTypeBadge type={incident.incident_type} /></td>
                  <td>
                    <div className="cell-primary">{incident.batch?.item?.technical_name}</div>
                    <div className="cell-muted">Lote: {incident.batch?.batch_number}</div>
                  </td>
                  <td style={{ maxWidth: '300px' }}>{incident.description}</td>
                  <td style={{ color: 'var(--success)', fontWeight: 600 }}>{incident.action_taken || '-'}</td>
                </tr>
              ))}
              {incidents.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🛡️</div>
                    No se han registrado incidentes de seguridad.
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

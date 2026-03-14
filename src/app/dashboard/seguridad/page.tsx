import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/services/user";
import { ComplianceServiceV2 } from "@/lib/services/compliance_v2";

export const dynamic = "force-dynamic";

export default async function SeguridadPage() {
    const user = await getCurrentUserProfile();
    if (!user) {
        redirect("/auth/login");
    }

    const incidents = await ComplianceServiceV2.getSafetyIncidents();

    return (
        <div className="dashboard-main">
            <div className="welcome-section">
                <h1>Seguridad Clínica</h1>
                <p>Monitoreo de Reactivovigilancia e incidentes de calidad.</p>
            </div>

            <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ fontSize: '1.25rem', color: 'var(--navy)' }}>Reportes de Incidentes y Recalls</h2>
                </div>

                <div className="table-responsive">
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
                                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem' }}>Fecha</th>
                                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem' }}>Tipo</th>
                                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem' }}>Producto / Lote</th>
                                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem' }}>Descripción</th>
                                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem' }}>Acciones Tomadas</th>
                            </tr>
                        </thead>
                        <tbody>
                            {incidents.map((incident) => (
                                <tr key={incident.id} style={{ borderBottom: '1px solid var(--border)', background: incident.incident_type === 'recall' ? '#fff1f2' : 'transparent' }}>
                                    <td style={{ padding: '1rem', fontSize: '0.85rem' }}>
                                        {new Date(incident.reported_at).toLocaleDateString()}
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <span style={{ 
                                            padding: '0.25rem 0.6rem', 
                                            borderRadius: '12px', 
                                            fontSize: '0.7rem', 
                                            fontWeight: '800',
                                            textTransform: 'uppercase',
                                            background: incident.incident_type === 'recall' ? '#fee2e2' : incident.incident_type === 'adverse_event' ? '#ffedd5' : '#f1f5f9',
                                            color: incident.incident_type === 'recall' ? '#991b1b' : incident.incident_type === 'adverse_event' ? '#9a3412' : '#475569'
                                        }}>
                                            {incident.incident_type}
                                        </span>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ fontWeight: '700', color: 'var(--navy)', fontSize: '0.85rem' }}>
                                            {incident.batch?.item?.technical_name}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            Lote: {incident.batch?.batch_number}
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem', fontSize: '0.85rem', maxWidth: '300px' }}>
                                        {incident.description}
                                    </td>
                                    <td style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--success)', fontWeight: '600' }}>
                                        {incident.action_taken || '-'}
                                    </td>
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

import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/services/user";
import { ComplianceServiceV2 } from "@/lib/services/compliance_v2";
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

    const [
        incidents,
        logs,
        movementsResponse
    ] = await Promise.all([
        ComplianceServiceV2.getSafetyIncidents(),
        ComplianceServiceV2.getEnvironmentalLogs(100),
        StockService.getAllMovements()
    ]);

    const movements = (movementsResponse.data as { id: string, movement_type: string, reason?: string | null, created_at: string, quantity: number, batch?: { batch_number: string, item?: { technical_name: string } } }[]) || [];

    // Filtrar mermas (salidas que no son consumo normal o tienen razones de daño/vencimiento)
    const mermas = movements.filter(m => 
        m.movement_type === 'exit' && 
        (m.reason?.toLowerCase().includes('vencid') || 
         m.reason?.toLowerCase().includes('dañ') || 
         m.reason?.toLowerCase().includes('falla') || 
         m.reason?.toLowerCase().includes('merma'))
    );

    return (
        <div className="dashboard-main">
            <div className="welcome-section">
                <h1>Reportes de Habilitación</h1>
                <p>Consolidados técnicos para cumplimiento de Resolución 3100 e ISO 15189.</p>
            </div>

            <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '2rem', alignItems: 'start' }}>
                
                {/* Menú de Reportes */}
                <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                    <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)' }}>
                        <h2 style={{ fontSize: '1rem', color: 'var(--navy)', fontWeight: '700', margin: 0 }}>Tipos de Reporte</h2>
                    </div>
                    <nav style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <a href="?type=resumen" className={`nav-item ${type === 'resumen' ? 'active' : ''}`} style={{ padding: '0.75rem', borderRadius: '8px', fontSize: '0.9rem', textDecoration: 'none', color: type === 'resumen' ? 'var(--primary)' : 'var(--navy-light)', background: type === 'resumen' ? 'var(--bg-app)' : 'transparent', fontWeight: type === 'resumen' ? '700' : '500' }}>
                            📊 Resumen Normativo
                        </a>
                        <a href="?type=reactivovigilancia" className={`nav-item ${type === 'reactivovigilancia' ? 'active' : ''}`} style={{ padding: '0.75rem', borderRadius: '8px', fontSize: '0.9rem', textDecoration: 'none', color: type === 'reactivovigilancia' ? 'var(--primary)' : 'var(--navy-light)', background: type === 'reactivovigilancia' ? 'var(--bg-app)' : 'transparent', fontWeight: type === 'reactivovigilancia' ? '700' : '500' }}>
                            🛡️ Reactivovigilancia
                        </a>
                        <a href="?type=mermas" className={`nav-item ${type === 'mermas' ? 'active' : ''}`} style={{ padding: '0.75rem', borderRadius: '8px', fontSize: '0.9rem', textDecoration: 'none', color: type === 'mermas' ? 'var(--primary)' : 'var(--navy-light)', background: type === 'mermas' ? 'var(--bg-app)' : 'transparent', fontWeight: type === 'mermas' ? '700' : '500' }}>
                            📉 Mermas y Bajas
                        </a>
                        <a href="?type=ambiental" className={`nav-item ${type === 'ambiental' ? 'active' : ''}`} style={{ padding: '0.75rem', borderRadius: '8px', fontSize: '0.9rem', textDecoration: 'none', color: type === 'ambiental' ? 'var(--primary)' : 'var(--navy-light)', background: type === 'ambiental' ? 'var(--bg-app)' : 'transparent', fontWeight: type === 'ambiental' ? '700' : '500' }}>
                            🌡️ Historial Ambiental
                        </a>
                    </nav>
                </div>

                {/* Contenido del Reporte */}
                <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                    
                    {type === 'resumen' && (
                        <div style={{ padding: '2rem' }}>
                            <h2 style={{ fontSize: '1.25rem', color: 'var(--navy)', marginBottom: '1.5rem' }}>Estado de Cumplimiento Técnico</h2>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
                                <div style={{ padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border)', background: '#f8fafc' }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--navy-light)', textTransform: 'uppercase' }}>Incidentes Totales</div>
                                    <div style={{ fontSize: '2rem', fontWeight: '800', color: incidents.length > 0 ? 'var(--error)' : 'var(--success)' }}>{incidents.length}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Eventos de reactivovigilancia</div>
                                </div>
                                <div style={{ padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border)', background: '#f8fafc' }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--navy-light)', textTransform: 'uppercase' }}>Mermas / Bajas</div>
                                    <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--navy)' }}>{mermas.length}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Descartes registrados</div>
                                </div>
                                <div style={{ padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border)', background: '#f8fafc' }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--navy-light)', textTransform: 'uppercase' }}>Registros Ambientales</div>
                                    <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--primary)' }}>{logs.length}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Lecturas térmicas</div>
                                </div>
                            </div>

                            <div style={{ marginTop: '2rem', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff' }}>
                                <h3 style={{ fontSize: '1rem', color: 'var(--navy)', marginBottom: '1rem' }}>Sugerencia Normativa</h3>
                                <p style={{ fontSize: '0.9rem', color: 'var(--navy-light)', lineHeight: '1.6' }}>
                                    Para las visitas de habilitación (Res. 3100), asegúrese de tener impresos o disponibles digitalmente los reportes de <b>Reactivovigilancia</b> del último año. El historial de <b>Monitoreo Ambiental</b> debe contar con al menos 2 registros diarios por ubicación de red de frío.
                                </p>
                            </div>
                        </div>
                    )}

                    {type === 'reactivovigilancia' && (
                        <div className="table-responsive">
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
                                        <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem' }}>Fecha</th>
                                        <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem' }}>Tipo</th>
                                        <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem' }}>Lote</th>
                                        <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem' }}>Acciones Correctivas</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {incidents.map(inc => (
                                        <tr key={inc.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                            <td style={{ padding: '1rem', fontSize: '0.85rem' }}>{new Date(inc.reported_at).toLocaleDateString()}</td>
                                            <td style={{ padding: '1rem', fontSize: '0.85rem', fontWeight: '700' }}>{inc.incident_type}</td>
                                            <td style={{ padding: '1rem', fontSize: '0.85rem' }}>{inc.batch?.batch_number}</td>
                                            <td style={{ padding: '1rem', fontSize: '0.85rem' }}>{inc.action_taken || 'Pendiente'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {type === 'ambiental' && (
                        <div className="table-responsive">
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
                                        <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem' }}>Fecha y Hora</th>
                                        <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem' }}>Ubicación</th>
                                        <th style={{ padding: '1rem', textAlign: 'center', fontSize: '0.75rem' }}>Temp (°C)</th>
                                        <th style={{ padding: '1rem', textAlign: 'center', fontSize: '0.75rem' }}>Humedad (%)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map(log => (
                                        <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                            <td style={{ padding: '1rem', fontSize: '0.85rem' }}>{new Date(log.recorded_at).toLocaleString()}</td>
                                            <td style={{ padding: '1rem', fontSize: '0.85rem' }}>{log.locations?.name}</td>
                                            <td style={{ padding: '1rem', textAlign: 'center', fontWeight: '700' }}>{log.temperature}</td>
                                            <td style={{ padding: '1rem', textAlign: 'center' }}>{log.humidity || '--'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {type === 'mermas' && (
                        <div className="table-responsive">
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
                                        <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem' }}>Fecha</th>
                                        <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem' }}>Producto</th>
                                        <th style={{ padding: '1rem', textAlign: 'center', fontSize: '0.75rem' }}>Cant</th>
                                        <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem' }}>Motivo / Justificación</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {mermas.map(m => (
                                        <tr key={m.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                            <td style={{ padding: '1rem', fontSize: '0.85rem' }}>{new Date(m.created_at).toLocaleDateString()}</td>
                                            <td style={{ padding: '1rem', fontSize: '0.85rem' }}>{m.batch?.item?.technical_name}</td>
                                            <td style={{ padding: '1rem', textAlign: 'center', fontWeight: '700', color: 'var(--error)' }}>-{m.quantity}</td>
                                            <td style={{ padding: '1rem', fontSize: '0.85rem' }}>{m.reason}</td>
                                        </tr>
                                    ))}
                                    {mermas.length === 0 && (
                                        <tr>
                                            <td colSpan={4} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No hay reportes de mermas registrados.</td>
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

import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/services/user";
import { CatalogService } from "@/lib/services/catalog";
import { ComplianceServiceV2 } from "@/lib/services/compliance_v2";
import * as Actions from "./actions";

export const dynamic = "force-dynamic";

export default async function MonitoreoPage() {
    const user = await getCurrentUserProfile();
    if (!user) {
        redirect("/auth/login");
    }

    const [
        { data: locations },
        logs
    ] = await Promise.all([
        CatalogService.getLocations(),
        ComplianceServiceV2.getEnvironmentalLogs(30)
    ]);

    return (
        <div className="dashboard-main">
            <div className="welcome-section">
                <h1>Monitoreo Ambiental</h1>
                <p>Registro y control de temperatura y humedad para cumplimiento ISO 15189.</p>
            </div>

            <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem', alignItems: 'start' }}>
                
                {/* Formulario de Registro */}
                <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                    <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)' }}>
                        <h2 style={{ fontSize: '1.1rem', color: 'var(--navy)', fontWeight: '700', margin: 0 }}>Nueva Lectura</h2>
                    </div>
                    
                    <form action={Actions.submitEnvironmentalLog} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.5rem', color: 'var(--navy-light)' }}>Ubicación / Equipo *</label>
                            <select name="location_id" required style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                <option value="">Seleccione...</option>
                                {locations?.map(loc => (
                                    <option key={loc.id} value={loc.id}>{loc.name} ({loc.location_type})</option>
                                ))}
                            </select>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.5rem', color: 'var(--navy-light)' }}>Temperatura (°C) *</label>
                                <input 
                                    type="number" 
                                    step="0.1" 
                                    name="temperature" 
                                    required 
                                    placeholder="Ej: 22.5"
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }} 
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.5rem', color: 'var(--navy-light)' }}>Humedad (%)</label>
                                <input 
                                    type="number" 
                                    step="0.1" 
                                    name="humidity" 
                                    placeholder="Ej: 45"
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }} 
                                />
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.5rem', color: 'var(--navy-light)' }}>Observaciones</label>
                            <textarea 
                                name="notes" 
                                rows={3}
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', resize: 'none' }}
                                placeholder="Cualquier desviación o evento..."
                            ></textarea>
                        </div>

                        <button 
                            type="submit" 
                            className="btn-primary" 
                            style={{ 
                                marginTop: '0.5rem', 
                                padding: '0.875rem', 
                                width: '100%', 
                                justifyContent: 'center', 
                                fontSize: '0.9rem',
                                fontWeight: '700'
                            }}
                        >
                            Guardar Registro
                        </button>
                    </form>
                </div>

                {/* Historial Reciente */}
                <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                    <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2 style={{ fontSize: '1.1rem', color: 'var(--navy)', fontWeight: '700', margin: 0 }}>Historial de Lecturas (Últimas 30)</h2>
                    </div>

                    <div className="table-responsive">
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
                                    <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem' }}>Fecha y Hora</th>
                                    <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem' }}>Ubicación</th>
                                    <th style={{ padding: '1rem', textAlign: 'center', fontSize: '0.75rem' }}>Temp</th>
                                    <th style={{ padding: '1rem', textAlign: 'center', fontSize: '0.75rem' }}>Humedad</th>
                                    <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem' }}>Notas</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map((log) => (
                                    <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '1rem', fontSize: '0.85rem' }}>
                                            {new Date(log.created_at).toLocaleDateString()}
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem', fontWeight: '600', color: 'var(--navy)', fontSize: '0.85rem' }}>
                                            {log.locations?.name}
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                                            <span style={{ 
                                                fontWeight: '800', 
                                                fontSize: '1rem',
                                                color: log.temperature > 30 || log.temperature < 15 ? 'var(--error)' : 'var(--success)'
                                            }}>
                                                {log.temperature}°C
                                            </span>
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'center', fontSize: '0.9rem', color: 'var(--navy-light)' }}>
                                            {log.humidity ? `${log.humidity}%` : '--'}
                                        </td>
                                        <td style={{ padding: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {log.notes || '-'}
                                        </td>
                                    </tr>
                                ))}
                                {logs.length === 0 && (
                                    <tr>
                                        <td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                            No hay registros ambientales aún.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    );
}

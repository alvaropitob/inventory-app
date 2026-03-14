import { redirect, notFound } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/services/user";
import { StockService } from "@/lib/services/stock";
import * as Actions from "../../actions";

export const dynamic = "force-dynamic";

interface PageProps {
    params: Promise<{ batchId: string }>;
}

export default async function ReportarIncidentePage({ params }: PageProps) {
    const user = await getCurrentUserProfile();
    if (!user) {
        redirect("/auth/login");
    }

    const { batchId } = await params;
    const { data: batch, error } = await StockService.getBatchById(batchId);

    if (error || !batch) {
        notFound();
    }

    return (
        <div className="dashboard-main">
            <div className="welcome-section">
                <h1>Reportar Incidente de Seguridad</h1>
                <p>Usted está reportando una novedad de reactivovigilancia para un lote específico.</p>
            </div>

            <div className="row">
                <div className="col-12" style={{ maxWidth: '800px' }}>
                    <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                        <div style={{ padding: '1.5rem', background: '#fff1f2', borderBottom: '1px solid #fda4af' }}>
                            <h2 style={{ fontSize: '1.1rem', color: '#991b1b', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                                Detalle del Producto y Lote
                            </h2>
                        </div>
                        
                        <div style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                            <div>
                                <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--navy-light)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Producto</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--navy)' }}>{batch.item.technical_name}</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{batch.item.commercial_name || 'Sin nombre comercial'}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--navy-light)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Lote / Ubicación</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--navy)' }}>{batch.batch_number}</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{batch.location.name}</div>
                            </div>
                        </div>

                        <form action={Actions.submitSafetyIncident} style={{ padding: '1.5rem', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <input type="hidden" name="batch_id" value={batchId} />
                            
                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.5rem', color: 'var(--navy)' }}>Tipo de Incidente *</label>
                                <select 
                                    name="incident_type" 
                                    required 
                                    style={{ width: '100%', padding: '0.875rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.95rem' }}
                                >
                                    <option value="">Seleccione el tipo...</option>
                                    <option value="recall">Recall de Fabricante (Retiro de Lote)</option>
                                    <option value="adverse_event">Evento Adverso (Falla en paciente/control)</option>
                                    <option value="quality_failure">Falla de Calidad (Integridad, Precipitado, etc.)</option>
                                    <option value="other">Otros / Noticia Técnica</option>
                                </select>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                                    <b>Nota:</b> Los incidentes tipo &apos;Recall&apos; y &apos;Falla de Calidad&apos; bloquearán el lote automáticamente.
                                </p>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.5rem', color: 'var(--navy)' }}>Descripción Detallada *</label>
                                <textarea 
                                    name="description" 
                                    required 
                                    rows={4}
                                    placeholder="Describa el incidente, cómo se detectó y el impacto observado..."
                                    style={{ width: '100%', padding: '0.875rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.95rem', resize: 'none' }}
                                ></textarea>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.5rem', color: 'var(--navy)' }}>Acción Tomada e Inmediata</label>
                                <textarea 
                                    name="action_taken" 
                                    rows={3}
                                    placeholder="Ej: Se retiró de nevera y se marcó físicamente como BLOQUEADO..."
                                    style={{ width: '100%', padding: '0.875rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.95rem', resize: 'none' }}
                                ></textarea>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                <button 
                                    type="button" 
                                    onClick={() => redirect("/dashboard/inventario")}
                                    className="btn-secondary" 
                                    style={{ flex: 1, padding: '1rem', justifyContent: 'center' }}
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" 
                                    className="btn-primary" 
                                    style={{ flex: 2, padding: '1rem', justifyContent: 'center', background: '#e11d48' }}
                                >
                                    Confirmar y Reportar Incidente
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}

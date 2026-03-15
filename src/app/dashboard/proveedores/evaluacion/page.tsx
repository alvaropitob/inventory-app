import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/services/user";
import { CatalogService } from "@/lib/services/catalog";
import { ComplianceService } from "@/lib/services/compliance";
import * as Actions from "./actions";

export const dynamic = "force-dynamic";

export default async function EvaluacionProveedoresPage() {
    const user = await getCurrentUserProfile();
    if (!user) {
        redirect("/auth/login");
    }

    const [suppliers, evaluations] = await Promise.all([
        CatalogService.getSuppliers(),
        ComplianceService.getSupplierEvaluations()
    ]);

    return (
        <div className="dashboard-main">
            <div className="welcome-section">
                <h1>Evaluación de Proveedores</h1>
                <p>Monitoreo de desempeño y cumplimiento de aliados comerciales.</p>
            </div>

            <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem' }}>
                
                {/* Historial de Evaluaciones */}
                <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                    <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--navy)' }}>Desempeño Reciente</h2>
                    </div>
                    <div className="table-responsive">
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
                                    <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem' }}>Fecha</th>
                                    <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem' }}>Proveedor</th>
                                    <th style={{ padding: '1rem', textAlign: 'center', fontSize: '0.75rem' }}>Puntaje</th>
                                </tr>
                            </thead>
                            <tbody>
                                {evaluations.map((ev) => (
                                    <tr key={ev.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '1rem', fontSize: '0.85rem' }}>
                                            {new Date(ev.evaluation_date).toLocaleDateString()}
                                        </td>
                                        <td style={{ padding: '1rem', fontWeight: '700', color: 'var(--navy)', fontSize: '0.85rem' }}>
                                            {ev.supplier?.name}
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                                            <span style={{ 
                                                background: ev.total_score >= 4 ? 'var(--success-light)' : ev.total_score >= 3 ? 'var(--warning-light)' : 'var(--error-light)', 
                                                color: ev.total_score >= 4 ? 'var(--success)' : ev.total_score >= 3 ? 'var(--warning)' : 'var(--error)', 
                                                padding: '0.25rem 0.6rem', 
                                                borderRadius: '12px', 
                                                fontSize: '0.85rem', 
                                                fontWeight: '800' 
                                            }}>
                                                {Number(ev.total_score).toFixed(1)} / 5.0
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {evaluations.length === 0 && (
                                    <tr>
                                        <td colSpan={3} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                            No hay evaluaciones registradas.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Formulario de Evaluación */}
                <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'stretch', background: 'var(--bg-app)', border: '1px solid var(--primary-light)' }}>
                    <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)' }}>
                        <h2 style={{ fontSize: '1.1rem', color: 'var(--primary)', fontWeight: '800' }}>Nueva Evaluación Técnica</h2>
                    </div>
                    <form action={Actions.submitSupplierEvaluation} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.5rem' }}>Seleccionar Proveedor *</label>
                            <select name="supplier_id" required style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                <option value="">Seleccione un proveedor...</option>
                                {suppliers.data?.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', marginBottom: '0.5rem', color: 'var(--navy-light)' }}>Calidad (1-5)</label>
                                <input type="number" name="criteria_quality" min="1" max="5" defaultValue="5" required style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border)', textAlign: 'center', fontWeight: '700' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', marginBottom: '0.5rem', color: 'var(--navy-light)' }}>Entrega (1-5)</label>
                                <input type="number" name="criteria_delivery_time" min="1" max="5" defaultValue="5" required style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border)', textAlign: 'center', fontWeight: '700' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', marginBottom: '0.5rem', color: 'var(--navy-light)' }}>Soporte (1-5)</label>
                                <input type="number" name="criteria_support" min="1" max="5" defaultValue="5" required style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border)', textAlign: 'center', fontWeight: '700' }} />
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.5rem' }}>Observaciones / Justificación</label>
                            <textarea name="comments" rows={3} placeholder="Describa el motivo de la calificación..." style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border)', resize: 'none' }}></textarea>
                        </div>

                        <button type="submit" className="btn-primary" style={{ padding: '1rem', justifyContent: 'center', fontSize: '1rem' }}>
                            Guardar Evaluación
                        </button>
                    </form>
                </div>

            </div>
        </div>
    );
}

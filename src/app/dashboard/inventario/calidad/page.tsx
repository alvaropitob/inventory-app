import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/services/user";
import { ComplianceService } from "@/lib/services/compliance";
import VerificationForm from "./VerificationForm";
import * as Actions from "./actions";

export const dynamic = "force-dynamic";

export default async function CalidadPage() {
    const user = await getCurrentUserProfile();
    if (!user) {
        redirect("/auth/login");
    }

    const pendingBatches = await ComplianceService.getPendingVerifications();

    return (
        <div className="dashboard-main">
            <div className="welcome-section">
                <h1>Verificación de Calidad</h1>
                <p>Liberación técnica de insumos en cuarentena para uso clínico.</p>
            </div>

            <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ fontSize: '1.25rem', color: 'var(--navy)' }}>Lotes Pendientes de Verificación</h2>
                    <span style={{ 
                        background: 'var(--warning-light)', 
                        color: 'var(--warning)', 
                        padding: '0.4rem 0.8rem', 
                        borderRadius: '20px', 
                        fontSize: '0.75rem', 
                        fontWeight: '700' 
                    }}>
                        {pendingBatches.length} pendientes
                    </span>
                </div>

                <div className="table-responsive">
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
                                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem' }}>Ingreso</th>
                                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem' }}>Producto</th>
                                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem' }}>Lote / Ubicación</th>
                                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem' }}>Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pendingBatches.map((batch) => (
                                <tr key={batch.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '1rem', fontSize: '0.85rem' }}>
                                        {new Date(batch.created_at).toLocaleDateString()}
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ fontWeight: '700', color: 'var(--navy)', fontSize: '0.85rem' }}>
                                            {batch.item?.technical_name}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            {batch.item?.internal_code}
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ fontWeight: '600', fontSize: '0.85rem' }}>{batch.batch_number}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{batch.location?.name}</div>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <details style={{ position: 'relative' }}>
                                            <summary style={{ 
                                                listStyle: 'none', 
                                                cursor: 'pointer', 
                                                padding: '0.5rem 1rem', 
                                                background: 'var(--primary)', 
                                                color: '#fff', 
                                                borderRadius: '6px',
                                                fontSize: '0.75rem',
                                                fontWeight: '700',
                                                textAlign: 'center'
                                            }}>
                                                Verificar
                                            </summary>
                                            <div style={{ 
                                                position: 'absolute', 
                                                right: 0, 
                                                top: '100%', 
                                                zIndex: 100, 
                                                background: '#fff', 
                                                border: '1px solid var(--border)', 
                                                borderRadius: '12px', 
                                                padding: '1.5rem', 
                                                boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                                                width: '350px',
                                                marginTop: '0.5rem'
                                            }}>
                                                <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--navy)' }}>Validación Técnica</h3>
                                                <VerificationForm 
                                                  batchId={batch.id} 
                                                  action={Actions.submitQualityVerification} 
                                                  userName={user.username}
                                                />
                                            </div>
                                        </details>
                                    </td>
                                </tr>
                            ))}
                            {pendingBatches.length === 0 && (
                                <tr>
                                    <td colSpan={4} style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>✨</div>
                                        No hay lotes en cuarentena pendientes de verificación.
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

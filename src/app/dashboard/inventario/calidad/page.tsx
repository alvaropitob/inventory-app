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
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Verificación de Calidad</h1>
          <p className="page-header-subtitle">Liberación técnica de insumos en cuarentena para uso clínico.</p>
        </div>
      </div>

      <div className="table-card">
        <div className="card-section-header">
          <h2 className="card-section-title">Lotes Pendientes de Verificación</h2>
          <span className="badge-pending">{pendingBatches.length} pendientes</span>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ingreso</th>
                <th>Producto</th>
                <th>Lote / Ubicación</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {pendingBatches.map((batch) => (
                <tr key={batch.id}>
                  <td>{new Date(batch.created_at).toLocaleDateString()}</td>
                  <td>
                    <div className="cell-primary">{batch.item?.technical_name}</div>
                    <div className="cell-muted">{batch.item?.internal_code}</div>
                  </td>
                  <td>
                    <div className="cell-primary">{batch.batch_number}</div>
                    <div className="cell-muted">{batch.location?.name}</div>
                  </td>
                  <td style={{ position: 'relative' }}>
                    <details>
                      <summary className="verify-btn">Verificar</summary>
                      <div className="verify-dropdown">
                        <h3>Validación Técnica</h3>
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

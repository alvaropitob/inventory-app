import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/services/user";
import { CatalogService } from "@/lib/services/catalog";
import { ComplianceService } from "@/lib/services/compliance";
import * as Actions from "./actions";

export const dynamic = "force-dynamic";

function ScoreBadge({ score }: { score: number }) {
  const cls = score >= 4 ? 'score-badge-good' : score >= 3 ? 'score-badge-fair' : 'score-badge-poor';
  return <span className={`score-badge ${cls}`}>{Number(score).toFixed(1)} / 5.0</span>;
}

export default async function EvaluacionProveedoresPage() {
  const user = await getCurrentUserProfile();
  if (!user) {
    redirect("/auth/login");
  }

  const [suppliers, evaluations] = await Promise.all([
    CatalogService.getSuppliers(),
    ComplianceService.getSupplierEvaluations(),
  ]);

  return (
    <div className="dashboard-main">
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Evaluación de Proveedores</h1>
          <p className="page-header-subtitle">Monitoreo de desempeño y cumplimiento de aliados comerciales.</p>
        </div>
      </div>

      <div className="eval-grid">
        <div className="table-card">
          <div className="card-section-header">
            <h2 className="card-section-title">Desempeño Reciente</h2>
          </div>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Proveedor</th>
                  <th className="cell-center">Puntaje</th>
                </tr>
              </thead>
              <tbody>
                {evaluations.map((ev) => (
                  <tr key={ev.id}>
                    <td>{new Date(ev.evaluation_date).toLocaleDateString()}</td>
                    <td className="cell-primary">{ev.supplier?.name}</td>
                    <td className="cell-center"><ScoreBadge score={ev.total_score} /></td>
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

        <div className="form-card" style={{ borderColor: 'var(--primary-light)' }}>
          <div className="form-card-header">
            <h2 className="form-card-title" style={{ color: 'var(--primary)' }}>Nueva Evaluación Técnica</h2>
          </div>
          <form action={Actions.submitSupplierEvaluation} className="form-card-body form-fields">
            <div>
              <label className="form-label">Seleccionar Proveedor *</label>
              <select name="supplier_id" required className="form-select">
                <option value="">Seleccione un proveedor...</option>
                {suppliers.data?.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div className="form-grid-2" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
              <div>
                <label className="form-label">Calidad (1-5)</label>
                <input className="form-input" type="number" name="criteria_quality" min="1" max="5" defaultValue="5" required style={{ textAlign: 'center' }} />
              </div>
              <div>
                <label className="form-label">Entrega (1-5)</label>
                <input className="form-input" type="number" name="criteria_delivery_time" min="1" max="5" defaultValue="5" required style={{ textAlign: 'center' }} />
              </div>
              <div>
                <label className="form-label">Soporte (1-5)</label>
                <input className="form-input" type="number" name="criteria_support" min="1" max="5" defaultValue="5" required style={{ textAlign: 'center' }} />
              </div>
            </div>

            <div>
              <label className="form-label">Observaciones / Justificación</label>
              <textarea
                name="comments"
                rows={3}
                className="form-textarea"
                placeholder="Describa el motivo de la calificación..."
                style={{ resize: 'none' }}
              />
            </div>

            <button type="submit" className="btn-primary btn-block">
              Guardar Evaluación
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

import { redirect, notFound } from "next/navigation";
import Link from "next/link";
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
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Reportar Incidente de Seguridad</h1>
          <p className="page-header-subtitle">
            Usted está reportando una novedad de reactivovigilancia para un lote específico.
          </p>
        </div>
      </div>

      <div className="incident-wrapper">
        <div className="form-card">
          <div className="incident-alert-header">
            <h2 className="incident-alert-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                <path d="M12 9v4"/>
                <path d="M12 17h.01"/>
              </svg>
              Detalle del Producto y Lote
            </h2>
          </div>

          <div className="incident-info-grid">
            <div>
              <div className="incident-field-label">Producto</div>
              <div className="incident-field-value">{batch.item.technical_name}</div>
              <div className="incident-field-sub">{batch.item.commercial_name || 'Sin nombre comercial'}</div>
            </div>
            <div>
              <div className="incident-field-label">Lote / Ubicación</div>
              <div className="incident-field-value">{batch.batch_number}</div>
              <div className="incident-field-sub">{batch.location.name}</div>
            </div>
          </div>

          <form action={Actions.submitSafetyIncident} className="incident-form-body">
            <input type="hidden" name="batch_id" value={batchId} />

            <div>
              <label className="form-label">Tipo de Incidente *</label>
              <select name="incident_type" required className="form-select">
                <option value="">Seleccione el tipo...</option>
                <option value="recall">Recall de Fabricante (Retiro de Lote)</option>
                <option value="adverse_event">Evento Adverso (Falla en paciente/control)</option>
                <option value="quality_failure">Falla de Calidad (Integridad, Precipitado, etc.)</option>
                <option value="other">Otros / Noticia Técnica</option>
              </select>
              <p className="form-hint">
                <b>Nota:</b> Los incidentes tipo &apos;Recall&apos; y &apos;Falla de Calidad&apos; bloquearán el lote automáticamente.
              </p>
            </div>

            <div>
              <label className="form-label">Descripción Detallada *</label>
              <textarea
                name="description"
                required
                rows={4}
                placeholder="Describa el incidente, cómo se detectó y el impacto observado..."
                className="form-textarea"
                style={{ resize: 'none' }}
              />
            </div>

            <div>
              <label className="form-label">Acción Tomada e Inmediata</label>
              <textarea
                name="action_taken"
                rows={3}
                placeholder="Ej: Se retiró de nevera y se marcó físicamente como BLOQUEADO..."
                className="form-textarea"
                style={{ resize: 'none' }}
              />
            </div>

            <div className="incident-actions">
              <Link
                href="/dashboard/inventario"
                className="btn-secondary"
                style={{ flex: 1, justifyContent: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center' }}
              >
                Cancelar
              </Link>
              <button
                type="submit"
                className="btn-danger"
                style={{ flex: 2, justifyContent: 'center' }}
              >
                Confirmar y Reportar Incidente
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

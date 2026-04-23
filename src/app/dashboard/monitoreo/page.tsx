import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/services/user";
import { CatalogService } from "@/lib/services/catalog";
import { ComplianceService } from "@/lib/services/compliance";
import * as Actions from "./actions";
import ContextualHelp from "@/components/ContextualHelp";

export const dynamic = "force-dynamic";

export default async function MonitoreoPage() {
  const user = await getCurrentUserProfile();
  if (!user) {
    redirect("/auth/login");
  }

  const [{ data: locations }, logs] = await Promise.all([
    CatalogService.getLocations(),
    ComplianceService.getEnvironmentalLogs(30),
  ]);

  return (
    <div className="dashboard-main">
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Monitoreo Ambiental</h1>
          <p className="page-header-subtitle">Registro y control de temperatura y humedad para cumplimiento ISO 15189.</p>
        </div>
      </div>

      <div className="equipment-grid">
        {/* Formulario de Registro */}
        <div className="form-card">
          <div className="form-card-header">
            <h2 className="form-card-title">Nueva Lectura</h2>
            <ContextualHelp content={{
              title: "Control de Red de Frío",
              description: "El monitoreo diario asegura que los reactivos mantengan su estabilidad (ISO 15189).",
              steps: [
                "Seleccione la ubicación o equipo específico.",
                "Ingrese temperatura en grados Celsius (°C).",
                "La humedad es opcional pero recomendada en almacenes.",
              ],
              tips: ["Si la temperatura está fuera de rango (ej. > 8°C en nevera), registre la acción correctiva en Notas."],
            }} />
          </div>

          <form action={Actions.submitEnvironmentalLog} className="form-card-body form-fields">
            <div>
              <label className="form-label">Ubicación / Equipo *</label>
              <select name="location_id" required className="form-select">
                <option value="">Seleccione...</option>
                {locations?.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.name} ({loc.location_type})</option>
                ))}
              </select>
            </div>

            <div className="form-grid-2">
              <div>
                <label className="form-label">Temperatura (°C) *</label>
                <input type="number" step="0.1" name="temperature" required placeholder="Ej: 22.5" className="form-input" />
              </div>
              <div>
                <label className="form-label">Humedad (%)</label>
                <input type="number" step="0.1" name="humidity" placeholder="Ej: 45" className="form-input" />
              </div>
            </div>

            <div>
              <label className="form-label">Observaciones</label>
              <textarea name="notes" rows={3} className="form-textarea" placeholder="Cualquier desviación o evento..." style={{ resize: 'none' }} />
            </div>

            <button type="submit" className="btn-primary btn-block" style={{ marginTop: '0.5rem' }}>
              Guardar Registro
            </button>
          </form>
        </div>

        {/* Historial Reciente */}
        <div className="table-card">
          <div className="card-section-header">
            <h2 className="card-section-title">Historial de Lecturas (Últimas 30)</h2>
          </div>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha y Hora</th>
                  <th>Ubicación</th>
                  <th className="cell-center">Temp</th>
                  <th className="cell-center">Humedad</th>
                  <th>Notas</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <div className="kardex-date">{new Date(log.created_at).toLocaleDateString()}</div>
                      <div className="kardex-time">{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </td>
                    <td className="cell-primary">{log.locations?.name}</td>
                    <td className="cell-center">
                      <span style={{ fontWeight: 800, fontSize: '1rem', color: log.temperature > 30 || log.temperature < 15 ? 'var(--error)' : 'var(--success)' }}>
                        {log.temperature}°C
                      </span>
                    </td>
                    <td className="cell-center cell-secondary">
                      {log.humidity ? `${log.humidity}%` : '--'}
                    </td>
                    <td className="audit-detail" style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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

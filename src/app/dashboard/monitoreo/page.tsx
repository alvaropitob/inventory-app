import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/services/user";
import { CatalogService } from "@/lib/services/catalog";
import { ComplianceService } from "@/lib/services/compliance";
import * as Actions from "./actions";
import ContextualHelp from "@/components/ContextualHelp";
import { BUSINESS_TIME_ZONE, getDateKeyInBusinessTimeZone } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function MonitoreoPage({ searchParams }: { searchParams: Promise<{ location?: string }> }) {
  const user = await getCurrentUserProfile();
  if (!user) {
    redirect("/auth/login");
  }

  const { location: requestedLocationId } = await searchParams;
  const { data: allLocations } = await CatalogService.getLocations();
  const locations = (allLocations || []).filter(location => location.is_active !== false);
  const selectedLocationId = locations.some(location => location.id === requestedLocationId)
    ? requestedLocationId
    : locations[0]?.id;
  const logs = await ComplianceService.getEnvironmentalLogs(60, selectedLocationId);
  const chartReadings = [...logs].reverse();
  const temperatures = chartReadings.map(log => Number(log.temperature));
  const minTemp = Math.min(...temperatures, 2);
  const maxTemp = Math.max(...temperatures, 8);
  const tempRange = Math.max(maxTemp - minTemp, 1);
  const chartTop = 24;
  const chartBottom = 176;
  const yForTemperature = (temperature: number) => chartBottom - ((temperature - minTemp) / tempRange) * (chartBottom - chartTop);
  const readingDays = [...new Set(chartReadings.map(log => getDateKeyInBusinessTimeZone(log.created_at)))];
  const todayInBogota = getDateKeyInBusinessTimeZone(new Date());
  const todayShifts = new Set(logs
    .filter(log => getDateKeyInBusinessTimeZone(log.created_at) === todayInBogota)
    .map(log => log.reading_type || "am"));
  const pendingShifts = (["am", "pm"] as const).filter(shift => !todayShifts.has(shift));

  return (
    <div className="dashboard-main">
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Monitoreo Ambiental</h1>
          <p className="page-header-subtitle">Registre y compare las lecturas AM y PM por ubicación.</p>
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
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.name} ({loc.location_type})</option>
                ))}
              </select>
            </div>

            <div className="form-grid-2">
              <div>
                <label className="form-label">Turno de lectura *</label>
                <select name="reading_type" required className="form-select"><option value="am">AM - Ma?ana</option><option value="pm">PM - Tarde</option></select>
              </div>
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
              <textarea name="notes" rows={3} className="form-textarea" defaultValue="Temperatura acorde a los límites de almacenamiento establecidos por el fabricante" placeholder="Cualquier desviación o evento..." style={{ resize: 'none' }} />
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
              <input type="checkbox" name="is_correction" style={{ width: "auto" }} />
              Registrar como corrección de una lectura existente (requiere motivo en observaciones)
            </label>

            <button type="submit" className="btn-primary btn-block" style={{ marginTop: '0.5rem' }}>
              Guardar Registro
            </button>
          </form>
        </div>

        {/* Historial Reciente */}
        <div className="table-card">
          <div className="card-section-header" style={{ alignItems: "end", gap: "1rem", flexWrap: "wrap" }}>
            <h2 className="card-section-title">Temperaturas por turno (AM / PM)</h2>
            <form method="get" style={{ display: "flex", gap: ".5rem", alignItems: "end" }}>
              <div><label className="form-label" htmlFor="chart-location">Área / ubicación</label><select id="chart-location" name="location" defaultValue={selectedLocationId || ""} className="form-select">
                {locations.map(location => <option key={location.id} value={location.id}>{location.name}</option>)}
              </select></div>
              <button className="btn-secondary" type="submit">Graficar</button>
            </form>
          </div>
          {chartReadings.length ? <div style={{ padding: '1rem 1.5rem 0' }}>
            <svg viewBox="0 0 800 220" role="img" aria-label="Gráfica de temperaturas AM y PM de la ubicación seleccionada" style={{ width: '100%', height: 'auto' }}>
              <rect x="24" y={yForTemperature(8)} width="752" height={yForTemperature(2) - yForTemperature(8)} fill="#dcfce7" />
              <line x1="24" y1={yForTemperature(8)} x2="776" y2={yForTemperature(8)} stroke="#16a34a" strokeDasharray="6 4" strokeWidth="2" />
              <line x1="24" y1={yForTemperature(2)} x2="776" y2={yForTemperature(2)} stroke="#16a34a" strokeDasharray="6 4" strokeWidth="2" />
              <text x="30" y={yForTemperature(8) - 5} fontSize="10" fill="#15803d">8 °C</text>
              <text x="30" y={yForTemperature(2) - 5} fontSize="10" fill="#15803d">2 °C</text>
              <line x1="24" y1="176" x2="776" y2="176" stroke="#cbd5e1" />
              {(["am", "pm"] as const).map((shift, shiftIndex) => {
                const shiftPoints = chartReadings.filter(log => (log.reading_type || "am") === shift).map(log => {
                  const dayIndex = readingDays.indexOf(getDateKeyInBusinessTimeZone(log.created_at));
                  const centerX = readingDays.length < 2 ? 400 : 24 + (dayIndex * 752) / (readingDays.length - 1);
                  return {
                    log,
                    x: centerX + (shiftIndex === 0 ? -5 : 5),
                    y: yForTemperature(Number(log.temperature)),
                  };
                });
                return <g key={shift}>
                  <polyline points={shiftPoints.map(point => `${point.x},${point.y}`).join(" ")} fill="none" stroke={shiftIndex === 0 ? "#0f766e" : "#2563eb"} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
                  {shiftPoints.map(point => <circle key={point.log.id} cx={point.x} cy={point.y} r="4" fill={shiftIndex === 0 ? "#0f766e" : "#2563eb"}><title>{`${new Date(point.log.created_at).toLocaleDateString('es-CO', { timeZone: BUSINESS_TIME_ZONE })} ${shift.toUpperCase()}: ${point.log.temperature}°C`}</title></circle>)}
                </g>;
              })}
              {readingDays.map(day => {
                const dayIndex = readingDays.indexOf(day);
                const x = readingDays.length < 2 ? 400 : 24 + (dayIndex * 752) / (readingDays.length - 1);
                return <text key={day} x={x} y="202" textAnchor="middle" fontSize="10" fill="#64748b">{new Date(`${day}T12:00:00Z`).toLocaleDateString('es-CO', { timeZone: "UTC", day: '2-digit', month: '2-digit' })}</text>;
              })}
            </svg>
            <p className="cell-secondary"><span style={{ color: "#0f766e", fontWeight: 600 }}>AM</span> · <span style={{ color: "#2563eb", fontWeight: 600 }}>PM</span>. Se grafica la ubicación seleccionada.</p>
          </div> : <p className="cell-secondary" style={{ padding: '0 1.5rem' }}>Registra lecturas de mañana y tarde para ver la tendencia.</p>}
          {selectedLocationId && <p className="cell-secondary" style={{ padding: "0 1.5rem 1rem" }}>
            {pendingShifts.length
              ? `Lectura pendiente de hoy (${todayInBogota}): ${pendingShifts.map(shift => shift.toUpperCase()).join(" y ")}.`
              : `Lecturas AM y PM de hoy registradas (${todayInBogota}).`}
          </p>}
          <div className="card-section-header">
            <h2 className="card-section-title">Historial de Lecturas (Últimas 30)</h2>
          </div>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha y Hora</th>
                  <th>Ubicación</th>
                  <th>Turno</th>
                  <th className="cell-center">Temp</th>
                  <th className="cell-center">Humedad</th>
                  <th>Notas</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <div className="kardex-date">{new Date(log.created_at).toLocaleDateString('es-CO', { timeZone: BUSINESS_TIME_ZONE })}</div>
                      <div className="kardex-time">{new Date(log.created_at).toLocaleTimeString('es-CO', { timeZone: BUSINESS_TIME_ZONE, hour: '2-digit', minute: '2-digit' })}</div>
                    </td>
                    <td className="cell-primary">{log.locations?.name}</td>
                    <td>{log.reading_type?.toUpperCase() || "AM"}</td>
                    <td className="cell-center">
                      <span style={{ fontWeight: 600, fontSize: 'var(--fs-md)', color: log.temperature > 30 || log.temperature < 15 ? 'var(--error)' : 'var(--success)' }}>
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
                    <td colSpan={6} className="workflow-empty-state">
                      <strong>Sin lecturas registradas</strong>
                      <span>Los registros ambientales aparecerán aquí.</span>
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

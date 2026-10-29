import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/services/user";
import { CatalogService } from "@/lib/services/catalog";
import { ComplianceService } from "@/lib/services/compliance";
import * as Actions from "./actions";
import ContextualHelp from "@/components/ContextualHelp";
import EnvironmentalHumidityField from "@/components/EnvironmentalHumidityField";
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
  const selectedLocation = locations.find(location => location.id === selectedLocationId);
  const configuredMin = selectedLocation?.temperature_min == null ? null : Number(selectedLocation.temperature_min);
  const configuredMax = selectedLocation?.temperature_max == null ? null : Number(selectedLocation.temperature_max);
  const rawLogs = await ComplianceService.getEnvironmentalLogs(60, selectedLocationId);
  const logs = rawLogs.map(log => {
    const temperatureMin = log.temperature_min_at_reading ?? log.locations?.temperature_min;
    const temperatureMax = log.temperature_max_at_reading ?? log.locations?.temperature_max;
    return {
      ...log,
      temperature_min_at_reading: temperatureMin,
      temperature_max_at_reading: temperatureMax,
      is_out_of_range: temperatureMin != null && temperatureMax != null
        ? log.temperature < temperatureMin || log.temperature > temperatureMax
        : Boolean(log.is_out_of_range),
      is_out_of_configured_range: configuredMin != null && configuredMax != null
        ? log.temperature < configuredMin || log.temperature > configuredMax
        : Boolean(log.is_out_of_range),
    };
  });
  const chartReadings = [...logs].reverse();
  const temperatureReadings = chartReadings.filter(log => Number.isFinite(Number(log.temperature)));
  const hasTemperatureRange = configuredMin != null && configuredMax != null && configuredMin < configuredMax;
  // For the Levey–Jennings display, the configured minimum and maximum are
  // treated as -3 DE and +3 DE; the center line is their midpoint.
  const leveyJenningsMean = hasTemperatureRange ? (configuredMin! + configuredMax!) / 2 : null;
  const leveyJenningsSd = hasTemperatureRange ? (configuredMax! - configuredMin!) / 6 : null;
  const observedTemperatures = temperatureReadings.map(log => Number(log.temperature));
  const extentValues = hasTemperatureRange
    ? [...observedTemperatures, configuredMin!, configuredMax!]
    : observedTemperatures;
  const observedMin = extentValues.length ? Math.min(...extentValues) : 0;
  const observedMax = extentValues.length ? Math.max(...extentValues) : 1;
  const chartPadding = Math.max((observedMax - observedMin) * 0.12, 0.2);
  const scaleMin = observedMin - chartPadding;
  const scaleMax = observedMax + chartPadding;
  const plotLeft = 112;
  const plotRight = 960;
  const plotTop = 34;
  const plotBottom = 265;
  const yForTemperature = (temperature: number) => plotBottom - ((temperature - scaleMin) / (scaleMax - scaleMin)) * (plotBottom - plotTop);
  const xForReading = (index: number) => temperatureReadings.length < 2
    ? (plotLeft + plotRight) / 2
    : plotLeft + (index * (plotRight - plotLeft)) / (temperatureReadings.length - 1);
  const leveyJenningsLines = hasTemperatureRange && leveyJenningsMean != null && leveyJenningsSd != null
    ? [
        { label: "+3 DE", value: leveyJenningsMean + 3 * leveyJenningsSd },
        { label: "+2 DE", value: leveyJenningsMean + 2 * leveyJenningsSd },
        { label: "+1 DE", value: leveyJenningsMean + leveyJenningsSd },
        { label: "Media", value: leveyJenningsMean },
        { label: "−1 DE", value: leveyJenningsMean - leveyJenningsSd },
        { label: "−2 DE", value: leveyJenningsMean - 2 * leveyJenningsSd },
        { label: "−3 DE", value: leveyJenningsMean - 3 * leveyJenningsSd },
      ]
    : [];
  const labelStride = Math.max(1, Math.ceil(temperatureReadings.length / 8));
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
              title: "Monitoreo por ubicación",
              description: "El monitoreo diario asegura que los reactivos mantengan su estabilidad (ISO 15189).",
              steps: [
                "Seleccione la ubicación monitoreada; la fecha se registra automáticamente.",
                "Ingrese la temperatura observada en grados Celsius (°C).",
                "La humedad es opcional.",
              ],
              tips: ["Cada ubicación tiene un rango ambiental configurable desde Configuración > Ubicaciones.", "Los límites configurados quedan guardados junto con cada lectura para conservar el criterio aplicado en ese momento."],
            }} />
          </div>

          <form action={Actions.submitEnvironmentalLog} className="form-card-body form-fields">
            <div>
              <label className="form-label">Ubicación / Equipo *</label>
              <select name="location_id" required className="form-select" defaultValue={selectedLocationId || ""}>
                <option value="">Seleccione...</option>
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.location_type}) · {loc.temperature_min != null && loc.temperature_max != null
                      ? `${loc.temperature_min}–${loc.temperature_max} °C`
                      : "Rango sin configurar"}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-grid-2">
              <div>
                <label className="form-label">Turno de lectura *</label>
                <select name="reading_type" required className="form-select"><option value="am">AM - Mañana</option><option value="pm">PM - Tarde</option></select>
              </div>
              <div>
                <label className="form-label">Temperatura (°C) *</label>
                <input type="number" step="0.1" name="temperature" required placeholder="Ej: 22.5" className="form-input" />
              </div>
              <EnvironmentalHumidityField />
            </div>

            <div>
              <label className="form-label">Observaciones</label>
              <textarea name="notes" rows={3} className="form-textarea" placeholder="Registre desviaciones, acciones realizadas o el motivo de corrección..." style={{ resize: 'none' }} />
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
            <div>
              <h2 className="card-section-title">Gráfica Levey–Jennings (AM / PM)</h2>
              <p className="cell-secondary">Los límites mínimo y máximo configurados se muestran como −3 y +3 DE; la media se calcula en el punto medio.</p>
            </div>
            <form method="get" style={{ display: "flex", gap: ".5rem", alignItems: "end" }}>
              <div><label className="form-label" htmlFor="chart-location">Área / ubicación</label><select id="chart-location" name="location" defaultValue={selectedLocationId || ""} className="form-select">
                {locations.map(location => <option key={location.id} value={location.id}>{location.name} · {location.temperature_min ?? "—"}–{location.temperature_max ?? "—"} °C</option>)}
              </select></div>
              <button className="btn-secondary" type="submit">Graficar</button>
            </form>
          </div>
          {temperatureReadings.length && hasTemperatureRange && leveyJenningsMean != null && leveyJenningsSd != null ? (
            <div style={{ padding: '1rem 1.5rem 0' }}>
              <div className="cell-secondary" style={{ marginBottom: ".5rem" }}>
                Rango configurado: <strong>{configuredMin}–{configuredMax} °C</strong>
                {" · "}Media del rango: <strong>{leveyJenningsMean.toFixed(2)} °C</strong>
                {" · "}DE estimada: <strong>{leveyJenningsSd.toFixed(2)} °C</strong>
              </div>
              <div style={{ overflowX: "auto" }}>
                <svg viewBox="0 0 1000 350" role="img" aria-label={`Gráfica Levey-Jennings de temperatura para ${selectedLocation?.name || "la ubicación seleccionada"}`} style={{ width: '100%', minWidth: 680, height: 'auto' }}>
                  <rect x={plotLeft} y={plotTop} width={plotRight - plotLeft} height={plotBottom - plotTop} fill="#ffffff" />
                  {leveyJenningsLines.slice(0, -1).map((line, index) => {
                    const nextLine = leveyJenningsLines[index + 1];
                    const y1 = yForTemperature(line.value);
                    const y2 = yForTemperature(nextLine.value);
                    return <rect
                      key={`band-${line.label}`}
                      x={plotLeft}
                      y={Math.min(y1, y2)}
                      width={plotRight - plotLeft}
                      height={Math.abs(y2 - y1)}
                      fill={index % 2 === 0 ? "#e5e7eb" : "#f3f4f6"}
                    />;
                  })}
                  <rect x={plotLeft} y={plotTop} width={plotRight - plotLeft} height={Math.max(0, yForTemperature(configuredMax!) - plotTop)} fill="#fee2e2" opacity=".65" />
                  <rect x={plotLeft} y={yForTemperature(configuredMin!)} width={plotRight - plotLeft} height={Math.max(0, plotBottom - yForTemperature(configuredMin!))} fill="#fee2e2" opacity=".65" />
                  {leveyJenningsLines.map((line) => {
                    const y = yForTemperature(line.value);
                    const isMean = line.label === "Media";
                    const isLimit = line.label === "+3 DE" || line.label === "−3 DE";
                    return <g key={line.label}>
                      <line x1={plotLeft} y1={y} x2={plotRight} y2={y} stroke={isMean ? "#111827" : isLimit ? "#b91c1c" : "#6b7280"} strokeWidth={isMean ? 2 : 1} strokeDasharray={isMean ? undefined : "4 3"} />
                      <text x={plotLeft - 8} y={y + 4} textAnchor="end" fontSize="11" fontWeight={isMean ? 700 : 500} fill={isLimit ? "#991b1b" : "#475569"}>
                        {line.label} · {line.value.toFixed(2)}
                      </text>
                    </g>;
                  })}
                  <line x1={plotLeft} y1={plotTop} x2={plotLeft} y2={plotBottom} stroke="#64748b" />
                  <line x1={plotLeft} y1={plotBottom} x2={plotRight} y2={plotBottom} stroke="#64748b" />
                  {temperatureReadings.map((log, index) => `${xForReading(index)},${yForTemperature(Number(log.temperature))}`).length > 1 && (
                    <polyline
                      points={temperatureReadings.map((log, index) => `${xForReading(index)},${yForTemperature(Number(log.temperature))}`).join(" ")}
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth="2"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  )}
                  {temperatureReadings.map((log, index) => {
                    const x = xForReading(index);
                    const y = yForTemperature(Number(log.temperature));
                    const pointColor = log.is_out_of_configured_range ? "#dc2626" : log.reading_type === "pm" ? "#2563eb" : "#0f766e";
                    const timestamp = new Date(log.created_at);
                    const dateLabel = timestamp.toLocaleDateString("es-CO", { timeZone: BUSINESS_TIME_ZONE, day: "2-digit", month: "2-digit" });
                    const timeLabel = timestamp.toLocaleTimeString("es-CO", { timeZone: BUSINESS_TIME_ZONE, hour: "2-digit", minute: "2-digit" });
                    const shouldLabel = index % labelStride === 0 || index === temperatureReadings.length - 1;
                    return <g key={log.id}>
                      <circle cx={x} cy={y} r="4" fill={pointColor} stroke="#ffffff" strokeWidth="1.5">
                        <title>{`${dateLabel} ${timeLabel} · ${(log.reading_type || "am").toUpperCase()} · ${log.temperature} °C${log.is_out_of_configured_range ? " · FUERA DEL RANGO CONFIGURADO" : ""}`}</title>
                      </circle>
                      {shouldLabel && <text x={x} y={plotBottom + 18} textAnchor="end" transform={`rotate(-35 ${x} ${plotBottom + 18})`} fontSize="10" fill="#475569">{dateLabel} {(log.reading_type || "am").toUpperCase()}</text>}
                    </g>;
                  })}
                  <text x="18" y={(plotTop + plotBottom) / 2} textAnchor="middle" fontSize="11" fill="#475569" transform={`rotate(-90 18 ${(plotTop + plotBottom) / 2})`}>Temperatura (°C)</text>
                  <text x={(plotLeft + plotRight) / 2} y="342" textAnchor="middle" fontSize="11" fill="#475569">Fecha y turno de lectura</text>
                </svg>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center", padding: ".25rem 0 .5rem", fontSize: "var(--fs-xs)", color: "var(--text-muted)" }}>
                <span><span style={{ color: "#0f766e", fontWeight: 700 }}>● AM</span> · <span style={{ color: "#2563eb", fontWeight: 700 }}>● PM</span></span>
                <span style={{ color: "#111827" }}>━ Media</span>
                <span style={{ color: "#b91c1c" }}>┄ Límites mínimo/máximo (±3 DE)</span>
                <span style={{ color: "#dc2626" }}>● Fuera del rango configurado</span>
              </div>
            </div>
          ) : chartReadings.length ? (
            <p className="cell-secondary" style={{ padding: '0 1.5rem 1rem' }}>
              {hasTemperatureRange
                ? "Aún no hay lecturas de temperatura para graficar."
                : "Configura la temperatura mínima y máxima de esta ubicación en Configuración > Ubicaciones para mostrar la gráfica Levey–Jennings."}
            </p>
          ) : (
            <p className="cell-secondary" style={{ padding: '0 1.5rem 1rem' }}>Registra lecturas de temperatura para ver la gráfica Levey–Jennings.</p>
          )}
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
                  <th className="cell-center">Rango °C</th>
                  <th className="cell-center">Estado de rango</th>
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
                      <span style={{ fontWeight: 600, fontSize: 'var(--fs-md)', color: log.is_out_of_range ? "#dc2626" : "#15803d" }}>
                        {log.temperature}°C
                      </span>
                    </td>
                    <td className="cell-center">
                      {log.temperature_min_at_reading != null && log.temperature_max_at_reading != null
                        ? `${log.temperature_min_at_reading}–${log.temperature_max_at_reading}`
                        : "—"}
                    </td>
                    <td className="cell-center">
                      <span className={`pill-badge ${log.is_out_of_range ? "pill-red" : "pill-green"}`}>
                        {log.is_out_of_range ? "Fuera de rango" : "En rango"}
                      </span>
                    </td>
                    <td className="cell-center cell-secondary">
                      {log.humidity != null ? `${log.humidity}%` : 'N/A'}
                    </td>
                    <td className="audit-detail" style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.notes || '-'}
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="workflow-empty-state">
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

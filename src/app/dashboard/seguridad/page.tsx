import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/services/user";
import { ComplianceService } from "@/lib/services/compliance";
import { saveMonthlyAlertReport } from "./actions";
import MonthlyAlertForm from "@/components/MonthlyAlertForm";
import { getYearInBusinessTimeZone } from "@/lib/dates";

export const dynamic = "force-dynamic";

function IncidentTypeBadge({ type }: { type: string }) {
  const cls =
    type === 'recall'         ? 'pill-red'    :
    type === 'adverse_event'  ? 'pill-orange' :
    'pill-slate';
  return <span className={`pill-badge ${cls}`}>{type}</span>;
}

export default async function SeguridadPage({ searchParams }: { searchParams: Promise<{ year?: string; edit?: string }> }) {
  const user = await getCurrentUserProfile();
  if (!user) {
    redirect("/auth/login");
  }

  const [incidents, monthlyReports] = await Promise.all([
    ComplianceService.getSafetyIncidents(),
    ComplianceService.getMonthlyAlertReports(),
  ]);
  const currentYear = getYearInBusinessTimeZone();
  const params = await searchParams;
  const requestedYear = Number(params.year);
  const selectedYear = Number.isInteger(requestedYear) && requestedYear >= 2000 && requestedYear <= currentYear + 1
    ? requestedYear
    : currentYear;
  const yearReports = monthlyReports.filter(report => report.period_month.slice(0, 4) === String(selectedYear));
  const reportsByMonth = new Map(yearReports.map(report => [report.period_month.slice(0, 7), report]));
  const requestedEditMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(params.edit || "") ? params.edit : undefined;
  const editMonth = requestedEditMonth && reportsByMonth.has(requestedEditMonth) ? requestedEditMonth : undefined;
  const monthlyRows = Array.from({ length: 12 }, (_, index) => {
    const month = `${selectedYear}-${String(index + 1).padStart(2, "0")}`;
    return reportsByMonth.get(month) || {
      id: month,
      period_month: `${month}-01`,
      verified_device_reagent_alerts: 0,
      verified_device_reagent_security_reports: 0,
      verified_medicine_biological_reports: 0,
      managed_reactivovigilance: 0,
      managed_tecnovigilance: 0,
      managed_pharmacovigilance: 0,
      vigilance_percentage: 100,
    };
  });
  const monthlyTotals = monthlyRows.reduce((totals, report) => ({
    verified_device_reagent_alerts: totals.verified_device_reagent_alerts + report.verified_device_reagent_alerts,
    verified_device_reagent_security_reports: totals.verified_device_reagent_security_reports + report.verified_device_reagent_security_reports,
    verified_medicine_biological_reports: totals.verified_medicine_biological_reports + report.verified_medicine_biological_reports,
    managed_reactivovigilance: totals.managed_reactivovigilance + report.managed_reactivovigilance,
    managed_tecnovigilance: totals.managed_tecnovigilance + report.managed_tecnovigilance,
    managed_pharmacovigilance: totals.managed_pharmacovigilance + report.managed_pharmacovigilance,
  }), { verified_device_reagent_alerts: 0, verified_device_reagent_security_reports: 0, verified_medicine_biological_reports: 0, managed_reactivovigilance: 0, managed_tecnovigilance: 0, managed_pharmacovigilance: 0 });
  const averageVigilancePercentage = monthlyRows.length
    ? monthlyRows.reduce((total, report) => total + Number(report.vigilance_percentage || 0), 0) / monthlyRows.length
    : 0;

  return (
    <div className="dashboard-main">
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Gesti&#243;n de Alertas</h1>
          <p className="page-header-subtitle">Monitoreo de Reactivovigilancia e incidentes de calidad.</p>
        </div>
      </div>

      <div className="form-card" style={{ marginBottom: "1.5rem" }}>
        <div className="form-card-header"><h2 className="form-card-title">Resumen mensual de alertas</h2></div>
        <div id="monthly-alert-form">
          <MonthlyAlertForm key={editMonth || "current-month"} reports={monthlyReports} action={saveMonthlyAlertReport} initialMonth={editMonth} />
        </div>
      </div>

      <div className="table-card" style={{ marginBottom: "1.5rem" }}>
        <div className="card-section-header" style={{ alignItems: "end", gap: "1rem", flexWrap: "wrap" }}>
          <h2 className="card-section-title">Indicadores por mes · {selectedYear}</h2>
          <form method="get" style={{ display: "flex", alignItems: "end", gap: ".5rem" }}>
            <label className="form-label" htmlFor="alert-year">Año</label>
            <input id="alert-year" className="form-input" type="number" name="year" min="2000" max={currentYear + 1} defaultValue={selectedYear} />
            <button className="btn-secondary" type="submit">Ver año</button>
          </form>
        </div>
        <div className="table-responsive">
          <table className="data-table">
            <thead><tr><th>Mes</th><th>Reportes de alertas sanitarias verificadas: dispositivos médicos y reactivos</th><th>Reportes de informes de seguridad verificados: dispositivos médicos y reactivos</th><th>Reportes de alertas e informes de seguridad verificadas: medicamentos y productos biológicos</th><th>Reactivovigilancia gestionada</th><th>Tecnovigilancia gestionada</th><th>Farmacovigilancia gestionada</th><th>% vigilancia</th><th>Acción</th></tr></thead>
            <tbody>
              {monthlyRows.map(report => {
                const month = report.period_month.slice(0, 7);
                const savedReport = reportsByMonth.has(month);
                return <tr key={report.id}>
                <td>{new Date(`${report.period_month}T12:00:00`).toLocaleDateString("es-CO", { month: "short", year: "numeric" })}</td>
                <td>{report.verified_device_reagent_alerts}</td><td>{report.verified_device_reagent_security_reports}</td><td>{report.verified_medicine_biological_reports}</td>
                <td>{report.managed_reactivovigilance}</td><td>{report.managed_tecnovigilance}</td><td>{report.managed_pharmacovigilance}</td><td>{Number(report.vigilance_percentage).toFixed(1)}%</td>
                <td>{savedReport ? <a className="btn-secondary" href={`?year=${selectedYear}&edit=${month}#monthly-alert-form`}>Editar</a> : <span className="cell-secondary">—</span>}</td>
              </tr>})}
              <tr><th>TOTAL</th><th>{monthlyTotals.verified_device_reagent_alerts}</th><th>{monthlyTotals.verified_device_reagent_security_reports}</th><th>{monthlyTotals.verified_medicine_biological_reports}</th><th>{monthlyTotals.managed_reactivovigilance}</th><th>{monthlyTotals.managed_tecnovigilance}</th><th>{monthlyTotals.managed_pharmacovigilance}</th><th>{averageVigilancePercentage.toFixed(1)}%</th><th>—</th></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="table-card">
        <div className="card-section-header">
          <h2 className="card-section-title">Reportes de Incidentes y Recalls</h2>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Producto / Lote</th>
                <th>Descripción</th>
                <th>Acciones Tomadas</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((incident) => (
                <tr key={incident.id} style={{ background: incident.incident_type === 'recall' ? '#fff1f2' : 'transparent' }}>
                  <td>{new Date(incident.reported_at).toLocaleDateString('es-CO')}</td>
                  <td><IncidentTypeBadge type={incident.incident_type} /></td>
                  <td>
                    <div className="cell-primary">{incident.batch?.item?.technical_name}</div>
                    <div className="cell-muted">Lote: {incident.batch?.batch_number}</div>
                  </td>
                  <td style={{ maxWidth: '300px' }}>{incident.description}</td>
                  <td style={{ color: 'var(--success)', fontWeight: 600 }}>{incident.action_taken || '-'}</td>
                </tr>
              ))}
              {incidents.length === 0 && (
                <tr>
                  <td colSpan={5} className="workflow-empty-state">
                    <strong>Sin incidentes registrados</strong>
                    <span>No se han registrado incidentes de seguridad.</span>
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

"use client";

import { useState } from "react";
import type { MonthlyAlertReport } from "@/lib/services/compliance";
import { getYearMonthInBusinessTimeZone } from "@/lib/dates";

type FormAction = (formData: FormData) => void | Promise<void>;
const countFields = [
  ["verified_device_reagent_alerts", "Reportes de alertas sanitarias verificadas: dispositivos médicos y reactivos"],
  ["verified_device_reagent_security_reports", "Reportes de informes de seguridad verificados: dispositivos médicos y reactivos"],
  ["verified_medicine_biological_reports", "Reportes de alertas e informes de seguridad verificados: medicamentos y productos biológicos"],
  ["managed_reactivovigilance", "Total de alertas y/o informes de seguridad en Reactivovigilancia gestionados que aplican al laboratorio."],
  ["managed_tecnovigilance", "Total de alertas y/o informes de seguridad en Tecnovigilancia gestionados que aplican al laboratorio."],
  ["managed_pharmacovigilance", "Total de alertas y/o informes de seguridad en Farmacovigilancia gestionados que aplican al laboratorio."],
] as const;

export default function MonthlyAlertForm({ reports, action }: { reports: MonthlyAlertReport[]; action: FormAction }) {
  const currentMonth = getYearMonthInBusinessTimeZone();
  const [month, setMonth] = useState(currentMonth);
  const [report, setReport] = useState(() => reports.find(row => row.period_month.slice(0, 7) === currentMonth));

  function chooseMonth(value: string) {
    setMonth(value);
    setReport(reports.find(row => row.period_month.slice(0, 7) === value));
  }

  return <form action={action} className="form-card-body form-fields">
    <div className="form-grid-2">
      <div><label className="form-label" htmlFor="alert-period">Mes *</label><input id="alert-period" type="month" name="period_month" required value={month} onChange={event => chooseMonth(event.target.value)} className="form-input" /></div>
      <div><label className="form-label">% vigilancia *</label><input type="number" name="vigilance_percentage" min="0" max="100" step="0.01" required defaultValue={report?.vigilance_percentage ?? 100} key={`${month}-percentage`} className="form-input" /></div>
    </div>
    <div className="form-grid-2">
      {countFields.map(([name, label]) => <div key={name}><label className="form-label">{label}</label><input type="number" name={name} min="0" step="1" required defaultValue={report?.[name] ?? 0} key={`${month}-${name}`} className="form-input" /></div>)}
    </div>
    <div><label className="form-label">Observaciones</label><textarea name="notes" rows={2} defaultValue={report?.notes || ""} key={`${month}-notes`} className="form-textarea" /></div>
    <p className="cell-secondary">Al cambiar el mes se cargan sus datos existentes. El porcentaje se registra manualmente porque el formato compartido no especifica una fórmula.</p>
    <button type="submit" className="btn-primary">Guardar resumen</button>
  </form>;
}

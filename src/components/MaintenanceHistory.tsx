"use client";

import { MaintenanceRecord } from "@/lib/services/equipment";
import { formatDateKeyInBusinessTimeZone } from "@/lib/dates";

interface MaintenanceHistoryProps {
  records: MaintenanceRecord[];
}

export default function MaintenanceHistory({ records }: MaintenanceHistoryProps) {
  if (!records || records.length === 0) {
    return (
      <div className="table-card maintenance-empty">
        <p className="cell-muted">No hay registros de mantenimiento para este equipo.</p>
      </div>
    );
  }

  return (
    <div className="table-card maintenance-history">
      <div className="card-section-header">
        <h3 className="card-section-title">Historial Técnico</h3>
      </div>
      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Fecha programada</th>
              <th>Fecha de realización</th>
              <th>Tipo</th>
              <th>Responsable</th>
              <th>Resultado</th>
              <th>Próxima fecha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy/5">
            {records.map((record) => (
              <tr key={record.id}>
                <td className="cell-muted">
                  {formatDateKeyInBusinessTimeZone(record.scheduled_date)}
                </td>
                <td className="cell-primary">
                  {formatDateKeyInBusinessTimeZone(record.execution_date)}
                </td>
                <td>
                  <span className={`pill-badge ${
                    record.type === 'preventive' ? 'pill-blue' :
                    record.type === 'calibration' ? 'pill-green' :
                    'pill-amber'
                  }`}>
                    {record.type === 'preventive' ? 'Preventivo' : 
                     record.type === 'calibration' ? 'Calibración' : 'Correctivo'}
                  </span>
                </td>
                <td className="cell-muted">
                  {record.provider_name || record.performed_by || "—"}
                </td>
                <td className="cell-primary">
                  {record.result}
                </td>
                <td className="cell-muted">
                  {formatDateKeyInBusinessTimeZone(record.next_due_date)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

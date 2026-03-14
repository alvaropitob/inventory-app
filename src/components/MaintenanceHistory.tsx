"use client";

import { MaintenanceRecord } from "@/lib/services/equipment";

interface MaintenanceHistoryProps {
  records: MaintenanceRecord[];
}

export default function MaintenanceHistory({ records }: MaintenanceHistoryProps) {
  if (!records || records.length === 0) {
    return (
      <div className="card shadow-glass text-center p-8">
        <p className="text-navy-light italic">No hay registros de mantenimiento para este equipo.</p>
      </div>
    );
  }

  return (
    <div className="card shadow-glass overflow-hidden" style={{ padding: '0' }}>
      <div className="p-6 border-b border-navy/5 bg-navy/5">
        <h3 className="text-xl font-black text-navy">Historial Ténico</h3>
      </div>
      <div className="table-responsive">
        <table className="w-full text-left">
          <thead className="bg-navy/5 border-b border-navy/10 text-[10px] font-black uppercase text-navy-light tracking-widest">
            <tr>
              <th className="px-6 py-4">Fecha</th>
              <th className="px-6 py-4">Tipo</th>
              <th className="px-6 py-4">Responsable</th>
              <th className="px-6 py-4">Resultado</th>
              <th className="px-6 py-4">Próximo Vencimiento</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy/5">
            {records.map((record) => (
              <tr key={record.id} className="hover:bg-navy/5 transition-colors">
                <td className="px-6 py-4 text-sm font-bold text-navy">
                  {new Date(record.execution_date).toLocaleDateString()}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${
                    record.type === 'preventive' ? 'bg-primary/10 text-primary' :
                    record.type === 'calibration' ? 'bg-success/10 text-success' :
                    'bg-warning/10 text-warning'
                  }`}>
                    {record.type === 'preventive' ? 'Preventivo' : 
                     record.type === 'calibration' ? 'Calibración' : 'Correctivo'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-navy-light">
                  {record.performed_by}
                </td>
                <td className="px-6 py-4 text-sm font-semibold text-navy">
                  {record.result}
                </td>
                <td className="px-6 py-4 text-sm text-navy-light">
                  {record.next_due_date ? new Date(record.next_due_date).toLocaleDateString() : 'N/A'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

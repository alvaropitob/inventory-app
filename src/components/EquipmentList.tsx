"use client";

import { Equipment } from "@/lib/services/equipment";
import Link from "next/link";

export default function EquipmentList({ equipments }: { equipments: Equipment[] }) {
  const getStatusBadge = (status: Equipment['status']) => {
    switch (status) {
      case 'active': return <span className="badge badge-success">Operativo</span>;
      case 'maintenance': return <span className="badge badge-warning">En Mantenimiento</span>;
      case 'out_of_service': return <span className="badge badge-danger">Fuera de Servicio</span>;
      default: return null;
    }
  };

  const formatDate = (date?: string) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString();
  };

  return (
    <div className="card" style={{ padding: '0' }}>
      <div className="table-responsive">
        <table className="table">
          <thead>
            <tr>
              <th className="p-4 text-left">Equipo</th>
              <th className="p-4 text-left">Ubicación</th>
              <th className="p-4 text-center">Estado</th>
              <th className="p-4 text-left">Prox. Mantenimiento</th>
              <th className="p-4 text-left">Prox. Calibración</th>
              <th className="p-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {equipments.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-navy-light italic">
                  No hay equipos registrados.
                </td>
              </tr>
            ) : (
              equipments.map((eq) => (
                <tr key={eq.id} className="border-t">
                  <td className="p-4">
                    <div className="font-bold">{eq.name}</div>
                    <div className="text-xs text-navy-light">{eq.brand} {eq.model} (S/N: {eq.serial_number})</div>
                  </td>
                  <td className="p-4">{eq.location?.name || "No asignada"}</td>
                  <td className="p-4 text-center">{getStatusBadge(eq.status)}</td>
                  <td className="p-4 text-sm">{formatDate(eq.next_preventive_maintenance)}</td>
                  <td className="p-4 text-sm">{formatDate(eq.next_calibration)}</td>
                  <td className="p-4 text-right">
                    <Link 
                      href={`/dashboard/equipos/${eq.id}`}
                      className="btn-secondary btn-sm"
                      style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem' }}
                    >
                      Historial Técnico
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

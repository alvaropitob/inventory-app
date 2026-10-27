"use client";

import { Equipment } from "@/lib/services/equipment";
import Link from "next/link";
import { formatDateKeyInBusinessTimeZone } from "@/lib/dates";

export default function EquipmentList({ equipments }: { equipments: Equipment[] }) {
  const getStatusBadge = (status: Equipment['status']) => {
    switch (status) {
      case 'active': return <span className="badge badge-success">Operativo</span>;
      case 'maintenance': return <span className="badge badge-warning">Mantenimiento</span>;
      case 'out_of_service': return <span className="badge badge-danger">Fuera de Servicio</span>;
      default: return null;
    }
  };

  return (
    <div className="table-responsive">
      <table className="table equipment-table">
        <thead>
          <tr>
            <th>Equipo</th>
            <th>Ubicación</th>
            <th className="cell-center">Estado</th>
            <th>Mantenimiento preventivo</th>
            <th>Calibración</th>
            <th className="cell-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {equipments.length === 0 ? (
            <tr>
              <td colSpan={6} className="cell-center cell-muted">
                No hay equipos registrados.
              </td>
            </tr>
          ) : (
            equipments.map((eq) => (
              <tr key={eq.id}>
                <td>
                  <div className="equipment-name">{eq.name}</div>
                  <div className="equipment-meta">Inventario: {eq.inventory_number || "N/A"}</div>
                  <div className="equipment-meta">Vencimiento INVIMA: {formatDateKeyInBusinessTimeZone(eq.invima_expiration_date)}</div>
                  <div className="equipment-meta">{eq.brand} {eq.model} • SN: {eq.serial_number}</div>
                </td>
                <td>
                  <div className="equipment-area">{eq.section?.name || "Área sin asignar"}</div>
                  <div className="equipment-meta">{eq.location?.name || "Ubicación no asignada"}</div>
                </td>
                <td className="cell-center">{getStatusBadge(eq.status)}</td>
                <td>Fecha de realización: {formatDateKeyInBusinessTimeZone(eq.last_preventive_maintenance)}<br />Próxima fecha: {formatDateKeyInBusinessTimeZone(eq.next_preventive_maintenance)}</td>
                <td>Realizada: {formatDateKeyInBusinessTimeZone(eq.last_calibration)}<br />Próxima calibración: {formatDateKeyInBusinessTimeZone(eq.next_calibration)}</td>
                <td className="cell-right">
                  <Link 
                    href={`/dashboard/equipos/${eq.id}`}
                    className="btn-secondary"

                  >
                    Ver Hoja de Vida
                  </Link>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

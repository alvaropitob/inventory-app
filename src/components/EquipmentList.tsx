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
            <th style={{ textAlign: 'center' }}>Estado</th>
            <th>Mantenimiento preventivo</th>
            <th>Calibración</th>
            <th style={{ textAlign: 'right' }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {equipments.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No hay equipos registrados.
              </td>
            </tr>
          ) : (
            equipments.map((eq) => (
              <tr key={eq.id}>
                <td>
                  <div style={{ fontWeight: 600, color: 'var(--navy)' }}>{eq.name}</div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>Inventario: {eq.inventory_number || "N/A"}</div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>Vencimiento INVIMA: {formatDateKeyInBusinessTimeZone(eq.invima_expiration_date)}</div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>{eq.brand} {eq.model} • SN: {eq.serial_number}</div>
                </td>
                <td>
                  <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600 }}>{eq.section?.name || "?rea sin asignar"}</div>
                  <div style={{ fontSize: 'var(--fs-xs)' }}>{eq.location?.name || "Ubicaci?n no asignada"}</div>
                </td>
                <td style={{ textAlign: 'center' }}>{getStatusBadge(eq.status)}</td>
                <td>Fecha de realización: {formatDateKeyInBusinessTimeZone(eq.last_preventive_maintenance)}<br />Próxima fecha: {formatDateKeyInBusinessTimeZone(eq.next_preventive_maintenance)}</td>
                <td>Realizada: {formatDateKeyInBusinessTimeZone(eq.last_calibration)}<br />Próxima calibración: {formatDateKeyInBusinessTimeZone(eq.next_calibration)}</td>
                <td style={{ textAlign: 'right' }}>
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

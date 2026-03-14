"use client";

import { Equipment } from "@/lib/services/equipment";
import Link from "next/link";

export default function EquipmentList({ equipments }: { equipments: Equipment[] }) {
  const getStatusBadge = (status: Equipment['status']) => {
    switch (status) {
      case 'active': return <span className="badge badge-success">Operativo</span>;
      case 'maintenance': return <span className="badge badge-warning">Mantenimiento</span>;
      case 'out_of_service': return <span className="badge badge-danger">Fuera de Servicio</span>;
      default: return null;
    }
  };

  const formatDate = (date?: string) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString();
  };

  return (
    <div className="table-responsive">
      <table className="table">
        <thead>
          <tr>
            <th>Equipo</th>
            <th>Ubicación</th>
            <th style={{ textAlign: 'center' }}>Estado</th>
            <th>Mantenimiento</th>
            <th>Calibración</th>
            <th style={{ textAlign: 'right' }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {equipments.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No hay equipos registrados.
              </td>
            </tr>
          ) : (
            equipments.map((eq) => (
              <tr key={eq.id}>
                <td>
                  <div style={{ fontWeight: '700', color: 'var(--navy)' }}>{eq.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{eq.brand} {eq.model} • SN: {eq.serial_number}</div>
                </td>
                <td>
                  <div style={{ fontSize: '0.85rem' }}>{eq.location?.name || "No asignada"}</div>
                </td>
                <td style={{ textAlign: 'center' }}>{getStatusBadge(eq.status)}</td>
                <td style={{ fontSize: '0.8rem' }}>{formatDate(eq.next_preventive_maintenance)}</td>
                <td style={{ fontSize: '0.8rem' }}>{formatDate(eq.next_calibration)}</td>
                <td style={{ textAlign: 'right' }}>
                  <Link 
                    href={`/dashboard/equipos/${eq.id}`}
                    className="btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '0.5rem 0.75rem' }}
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

import { EquipmentService } from "@/lib/services/equipment";
import MaintenanceRegistryForm from "@/components/MaintenanceRegistryForm";
import MaintenanceHistory from "@/components/MaintenanceHistory";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getExpirationSemaforo } from "@/lib/expiration-semaforo";

export default async function EquipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const equipment = await EquipmentService.getEquipmentById(id);

  if (!equipment.data) {
    notFound();
  }

  const history = await EquipmentService.getMaintenanceHistory(id);

  return (
    <div className="dashboard-main">
      <div className="page-header">
        <div className="equipment-detail-heading">
          <Link href="/dashboard/equipos" className="btn-secondary equipment-back-link">
            ← Volver
          </Link>
          <div>
            <h1 className="page-header-title">{equipment.data.name}</h1>
            <p className="page-header-subtitle">Hoja de Vida Técnica | S/N: {equipment.data.serial_number}</p>
          </div>
        </div>
      </div>

      <div className="eq-detail-grid">
        <div className="equipment-detail-stack">
          <div className="form-card">
            <div className="form-card-header">
              <h2 className="form-card-title">Nueva Intervención</h2>
            </div>
            <div className="form-card-body">
              <MaintenanceRegistryForm equipmentId={id} />
            </div>
          </div>

          <div className="form-card">
            <div className="form-card-header">
              <h2 className="form-card-title">Información Técnica</h2>
            </div>
            <div className="form-card-body equipment-technical-details">
              <div className="tech-info-row">
                <span className="cell-muted">No. Inventario:</span>
                <span className="equipment-detail-value">{equipment.data.inventory_number || "—"}</span>
              </div>
              <div className="tech-info-row">
                <span className="cell-muted">Área:</span>
                <span className="equipment-detail-value">{equipment.data.section?.name || "—"}</span>
              </div>
              <div className="tech-info-row">
                <span className="cell-muted">Rango de medición:</span>
                <span className="equipment-detail-value">{equipment.data.measurement_range || "—"}</span>
              </div>
              <div className="tech-info-row">
                <span className="cell-muted">Registro sanitario / riesgo:</span>
                <span className="equipment-detail-value">{equipment.data.sanitary_registration || "No aplica"} / {equipment.data.risk_classification || "No aplica"}</span>
              </div>
              <div className="tech-info-row">
                <span className="cell-muted">Vencimiento INVIMA:</span>
                <span
                  className="equipment-detail-value"
                  style={equipment.data.invima_expiration_date ? { color: getExpirationSemaforo(equipment.data.invima_expiration_date).color } : undefined}
                >
                  {equipment.data.invima_expiration_date
                    ? `${getExpirationSemaforo(equipment.data.invima_expiration_date).label} · ${equipment.data.invima_expiration_date}`
                    : "—"}
                </span>
              </div>
              <div className="tech-info-row">
                <span className="cell-muted">Frecuencias:</span>
                <span className="equipment-detail-value">Mantenimiento {equipment.data.maintenance_frequency || "—"}; calibración {equipment.data.calibration_frequency || "—"}</span>
              </div>
              <div className="tech-info-row">
                <span className="cell-muted">Responsable:</span>
                <span className="equipment-detail-value">{equipment.data.responsible || "—"}</span>
              </div>
              <div className="tech-info-row">
                <span className="cell-muted">Marca/Modelo:</span>
                <span className="equipment-detail-value">{equipment.data.brand} {equipment.data.model}</span>
              </div>
              <div className="tech-info-row">
                <span className="cell-muted">Ubicación:</span>
                <span className="equipment-detail-value">{equipment.data.location?.name || "No asignada"}</span>
              </div>
              <div className="tech-info-row">
                <span className="cell-muted">Estado Actual:</span>
                <span className="equipment-detail-value">{equipment.data.status}</span>
              </div>
            </div>
          </div>
        </div>

        <MaintenanceHistory records={history.data || []} />
      </div>
    </div>
  );
}

import { EquipmentService } from "@/lib/services/equipment";
import MaintenanceRegistryForm from "@/components/MaintenanceRegistryForm";
import MaintenanceHistory from "@/components/MaintenanceHistory";
import Link from "next/link";
import { notFound } from "next/navigation";

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/dashboard/equipos" className="btn-secondary" style={{ textDecoration: 'none', whiteSpace: 'nowrap' }}>
            ← Volver
          </Link>
          <div>
            <h1 className="page-header-title">{equipment.data.name}</h1>
            <p className="page-header-subtitle">Hoja de Vida Técnica | S/N: {equipment.data.serial_number}</p>
          </div>
        </div>
      </div>

      <div className="eq-detail-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
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
            <div className="form-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div className="tech-info-row">
                <span className="cell-muted">Marca/Modelo:</span>
                <span style={{ fontWeight: 600 }}>{equipment.data.brand} {equipment.data.model}</span>
              </div>
              <div className="tech-info-row">
                <span className="cell-muted">Ubicación:</span>
                <span style={{ fontWeight: 600 }}>{equipment.data.location?.name || "No asignada"}</span>
              </div>
              <div className="tech-info-row">
                <span className="cell-muted">Estado Actual:</span>
                <span style={{ fontWeight: 600 }}>{equipment.data.status}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="table-card">
          <MaintenanceHistory records={history.data || []} />
        </div>
      </div>
    </div>
  );
}

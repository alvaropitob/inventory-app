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
    <div className="dashboard-container">
      <header className="dashboard-header" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <Link href="/dashboard/equipos" className="btn-secondary btn-sm">← Volver</Link>
          <div>
            <h1 className="text-2xl font-bold text-navy">{equipment.data.name}</h1>
            <p className="text-navy-light">Hoja de Vida Técnica | S/N: {equipment.data.serial_number}</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <div className="card mb-6" style={{ padding: '1.5rem' }}>
            <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--primary)' }}>Nueva Intervención</h2>
            <MaintenanceRegistryForm equipmentId={id} />
          </div>

          <div className="card" style={{ padding: '1.5rem' }}>
            <h2 className="text-lg font-bold mb-4">Información Técnica</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b pb-2">
                <span className="text-navy-light">Marca/Modelo:</span>
                <span className="font-semibold">{equipment.data.brand} {equipment.data.model}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-navy-light">Ubicación:</span>
                <span className="font-semibold">{equipment.data.location?.name || "No asignada"}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-navy-light">Estado Actual:</span>
                <span className="font-semibold">{equipment.data.status}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <MaintenanceHistory records={history.data || []} />
        </div>
      </div>
    </div>
  );
}

import { EquipmentService, Equipment } from "@/lib/services/equipment";
import { CatalogService } from "@/lib/services/catalog";
import EquipmentList from "@/components/EquipmentList";
import EquipmentForm from "@/components/EquipmentForm";

export default async function EquipmentPage() {
  const [equipments, locations] = await Promise.all([
    EquipmentService.getEquipments(),
    CatalogService.getLocations()
  ]);

  return (
    <div className="dashboard-container">
      <header className="dashboard-header" style={{ marginBottom: '2rem' }}>
        <div>
          <h1 className="text-2xl font-bold text-navy">Gestión de Equipos y Analizadores</h1>
          <p className="text-navy-light">Hoja de vida técnica y control de mantenimiento (ISO 15189)</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <div className="card" style={{ padding: '1.5rem', position: 'sticky', top: '2rem' }}>
            <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--primary)' }}>Registro de Equipo</h2>
            <EquipmentForm locations={locations.data || []} />
          </div>
        </div>
        
        <div className="lg:col-span-2">
          <EquipmentList equipments={equipments.data || []} />
        </div>
      </div>
    </div>
  );
}

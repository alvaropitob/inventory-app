import { EquipmentService } from "@/lib/services/equipment";
import { CatalogService } from "@/lib/services/catalog";
import EquipmentList from "@/components/EquipmentList";
import EquipmentForm from "@/components/EquipmentForm";
import ContextualHelp from "@/components/ContextualHelp";

export default async function EquipmentPage() {
  const [equipments, locations] = await Promise.all([
    EquipmentService.getEquipments(),
    CatalogService.getLocations(),
  ]);

  return (
    <div className="dashboard-main">
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <div>
          <h1 className="page-header-title">Gestión de Equipos y Analizadores</h1>
          <p className="page-header-subtitle">Hoja de vida técnica y control de mantenimiento (ISO 15189)</p>
        </div>
      </div>

      <div className="equipment-grid">
        <div className="form-card">
          <div className="form-card-header">
            <h2 className="form-card-title">
              Registro de Equipo
            </h2>
            <ContextualHelp content={{
              title: "Guía de Registro de Equipos",
              description: "La hoja de vida técnica es un requisito fundamental para la habilitación (Res. 3100).",
              steps: [
                "Complete los datos identificatorios (Marca, Modelo, Serial).",
                "Asigne una ubicación para control de inventario.",
                "El estado 'Mantenimiento' bloqueará el uso en algunos reportes.",
              ],
              tips: ["Use el número de serie de la placa física, no el de la caja."],
            }} />
          </div>
          <div className="form-card-body">
            <EquipmentForm locations={locations.data || []} />
          </div>
        </div>

        <div className="table-card">
          <EquipmentList equipments={equipments.data || []} />
        </div>
      </div>
    </div>
  );
}

import { EquipmentService } from "@/lib/services/equipment";
import { CatalogService } from "@/lib/services/catalog";
import EquipmentList from "@/components/EquipmentList";
import EquipmentForm from "@/components/EquipmentForm";
import ContextualHelp from "@/components/ContextualHelp";

export default async function EquipmentPage() {
  const [equipments, locations] = await Promise.all([
    EquipmentService.getEquipments(),
    CatalogService.getLocations()
  ]);

  return (
    <div className="dashboard-main">
      <div className="welcome-section" style={{ marginBottom: '2rem' }}>
        <h1>Gestión de Equipos y Analizadores</h1>
        <p>Hoja de vida técnica y control de mantenimiento (ISO 15189)</p>
      </div>
 
      <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem', alignItems: 'start' }}>
        <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: '1.1rem', color: 'var(--navy)', fontWeight: '700', margin: 0 }}>
              Registro de Equipo
              <ContextualHelp content={{
                title: "Guía de Registro de Equipos",
                description: "La hoja de vida técnica es un requisito fundamental para la habilitación (Res. 3100).",
                steps: [
                  "Complete los datos identificatorios (Marca, Modelo, Serial).",
                  "Asigne una ubicación para control de inventario.",
                  "El estado 'Mantenimiento' bloqueará el uso en algunos reportes."
                ],
                tips: ["Use el número de serie de la placa física, no el de la caja."]
              }} />
            </h2>
          </div>
          <div style={{ padding: '1.5rem' }}>
            <EquipmentForm locations={locations.data || []} />
          </div>
        </div>
        
        <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'stretch', padding: 0 }}>
          <EquipmentList equipments={equipments.data || []} />
        </div>
      </div>
    </div>
  );
}

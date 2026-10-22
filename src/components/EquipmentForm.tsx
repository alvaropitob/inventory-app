"use client";

import { handleEquipmentAction } from "@/app/dashboard/equipos/actions";
import { useState } from "react";
interface Location {
  id: string;
  name: string;
}

interface Section { id: string; name: string; }

export default function EquipmentForm({ locations, sections }: { locations: Location[]; sections: Section[] }) {
  const [loading, setLoading] = useState(false);

  async function clientAction(formData: FormData) {
    setLoading(true);
    try {
      await handleEquipmentAction(formData);
      (document.getElementById("equipment-form") as HTMLFormElement)?.reset();
    } catch (error) {
      console.error(error);
      alert("Error al guardar el equipo");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form id="equipment-form" action={clientAction} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="form-group">
        <label>Número de inventario</label>
        <input name="inventory_number" placeholder="Ej: LCE.MB-03" />
      </div>

      <div className="form-group">
        <label>Nombre del Equipo / Analizador *</label>
        <input name="name" required placeholder="Ej: Cobas c311" />
      </div>

      <div className="form-group">
        <label>Área *</label>
        <select name="section_id" required defaultValue="">
          <option value="">Seleccione un área...</option>
          {sections.map(section => <option key={section.id} value={section.id}>{section.name}</option>)}
        </select>
      </div>

      <div className="form-group">
        <label>Rango de medición</label>
        <input name="measurement_range" placeholder="Ej: Verificar a 37 °C" />
      </div>

      <div className="form-row">
        <div className="form-group"><label>Registro sanitario</label><input name="sanitary_registration" placeholder="No requiere / registro" /></div>
        <div className="form-group"><label>Clasificación por riesgo</label><select name="risk_classification" defaultValue=""><option value="">No aplica</option><option value="I">I</option><option value="II">II</option><option value="IIA">IIA</option><option value="IIB">IIB</option><option value="III">III</option></select></div>
      </div>

      <div className="form-group">
        <label>Vencimiento INVIMA</label>
        <input type="date" name="invima_expiration_date" />
      </div>

      <div className="form-row">
        <div className="form-group"><label>Frecuencia de calibración</label><input name="calibration_frequency" placeholder="Ej: Anual / No requiere" /></div>
        <div className="form-group"><label>Frecuencia de mantenimiento</label><input name="maintenance_frequency" placeholder="Ej: Anual / Diaria" /></div>
      </div>

      <div className="form-group"><label>Responsable / proveedor</label><input name="responsible" placeholder="Biomédico, proveedor o usuario" /></div>

      <div className="form-row">
        <div className="form-group">
          <label>Marca</label>
          <input name="brand" placeholder="Ej: Roche" />
        </div>
        <div className="form-group">
          <label>Modelo</label>
          <input name="model" placeholder="Ej: c311" />
        </div>
      </div>

      <div className="form-group">
        <label>Número de Serie</label>
        <input name="serial_number" placeholder="SN-XXXXX" />
      </div>

      <div className="form-group">
        <label>Ubicación Actual *</label>
        <select name="location_id" required>
          <option value="">Seleccione una ubicación...</option>
          {locations.map(loc => (
            <option key={loc.id} value={loc.id}>{loc.name}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>Estado</label>
        <select name="status" defaultValue="active">
          <option value="active">Activo / Operativo</option>
          <option value="maintenance">En Mantenimiento</option>
          <option value="out_of_service">Fuera de Servicio</option>
        </select>
      </div>

      <button 
        type="submit" 
        disabled={loading}
        className="btn-primary"
        style={{ marginTop: '0.5rem', width: '100%' }}
      >
        {loading ? "Guardando..." : "Registrar Equipo"}
      </button>
    </form>
  );
}

"use client";

import { handleEquipmentAction } from "@/app/dashboard/equipos/actions";
import { useState } from "react";
import ContextualHelp from "./ContextualHelp";

interface Location {
  id: string;
  name: string;
}

export default function EquipmentForm({ locations }: { locations: Location[] }) {
  const [loading, setLoading] = useState(false);

  const helpContent = {
    title: "Registro de Hoja de Vida",
    description: "Este formulario registra equipos nuevos para el inventario técnico y control de mantenimiento preventivo.",
    steps: [
      "Ingrese el nombre comercial y marca del equipo.",
      "Asocie el equipo a una ubicación física actual.",
      "Defina el estado operativo inicial."
    ],
    tips: ["Asegúrese de copiar el número de serie exacto de la placa del equipo para trazabilidad ISO."]
  };

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
        <label>Nombre del Equipo / Analizador *</label>
        <input name="name" required placeholder="Ej: Cobas c311" />
      </div>

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

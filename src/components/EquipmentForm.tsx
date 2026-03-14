"use client";

import { handleEquipmentAction } from "@/app/dashboard/equipos/actions";
import { useState } from "react";

export default function EquipmentForm({ locations }: { locations: any[] }) {
  const [loading, setLoading] = useState(false);

  async function clientAction(formData: FormData) {
    setLoading(true);
    try {
      await handleEquipmentAction(formData);
      (document.getElementById("equipment-form") as HTMLFormElement)?.reset();
    } catch (error) {
      alert("Error al guardar el equipo");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form id="equipment-form" action={clientAction} className="space-y-4">
      <div>
        <label className="block text-xs font-bold mb-1 uppercase text-navy-light">Nombre del Equipo / Analizador</label>
        <input name="name" required placeholder="Ej: Cobas c311" className="w-full p-2 border rounded-md" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold mb-1 uppercase text-navy-light">Marca</label>
          <input name="brand" placeholder="Ej: Roche" className="w-full p-2 border rounded-md" />
        </div>
        <div>
          <label className="block text-xs font-bold mb-1 uppercase text-navy-light">Modelo</label>
          <input name="model" placeholder="Ej: c311" className="w-full p-2 border rounded-md" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold mb-1 uppercase text-navy-light">Número de Serie</label>
        <input name="serial_number" placeholder="SN-XXXXX" className="w-full p-2 border rounded-md" />
      </div>

      <div>
        <label className="block text-xs font-bold mb-1 uppercase text-navy-light">Ubicación Actual</label>
        <select name="location_id" className="w-full p-2 border rounded-md">
          <option value="">Seleccione una ubicación...</option>
          {locations.map(loc => (
            <option key={loc.id} value={loc.id}>{loc.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-bold mb-1 uppercase text-navy-light">Estado</label>
        <select name="status" className="w-full p-2 border rounded-md" defaultValue="active">
          <option value="active">Activo / Operativo</option>
          <option value="maintenance">En Mantenimiento</option>
          <option value="out_of_service">Fuera de Servicio</option>
        </select>
      </div>

      <button 
        type="submit" 
        disabled={loading}
        className="w-full bg-primary text-white p-3 rounded-md font-bold transition-all hover:bg-primary-dark disabled:opacity-50"
      >
        {loading ? "Guardando..." : "Registrar Equipo"}
      </button>
    </form>
  );
}

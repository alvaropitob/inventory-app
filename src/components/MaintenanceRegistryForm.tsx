"use client";

import { useState } from "react";
import { handleMaintenanceAction } from "@/app/dashboard/equipos/actions";

interface MaintenanceRegistryFormProps {
  equipmentId: string;
}

export default function MaintenanceRegistryForm({ equipmentId }: MaintenanceRegistryFormProps) {
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    try {
      await handleMaintenanceAction(formData);
      // Reset form or show success if needed
      (document.getElementById('maintenance-form') as HTMLFormElement).reset();
    } catch (error) {
      console.error(error);
      alert("Error al registrar mantenimiento");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card shadow-glass" style={{ padding: '2rem' }}>
      <h3 className="text-xl font-black text-navy mb-6">Nueva Intervención Técnica</h3>
      <form id="maintenance-form" action={handleSubmit} className="space-y-4">
        <input type="hidden" name="equipment_id" value={equipmentId} />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="form-group">
            <label className="block text-xs font-black uppercase text-navy-light mb-1">Tipo de Actividad</label>
            <select name="type" required className="input-field w-full">
              <option value="preventive">Mantenimiento Preventivo</option>
              <option value="corrective">Mantenimiento Correctivo</option>
              <option value="calibration">Calibración / Calificación</option>
            </select>
          </div>
          
          <div className="form-group">
            <label className="block text-xs font-black uppercase text-navy-light mb-1">Fecha de Ejecución</label>
            <input type="date" name="execution_date" required defaultValue={new Date().toISOString().split('T')[0]} className="input-field w-full" />
          </div>
        </div>

        <div className="form-group">
          <label className="block text-xs font-black uppercase text-navy-light mb-1">Técnico / Empresa Responsable</label>
          <input type="text" name="performed_by" placeholder="Ej: Servicio Técnico Abbott o Bioing. Juan Pérez" required className="input-field w-full" />
        </div>

        <div className="form-group">
          <label className="block text-xs font-black uppercase text-navy-light mb-1">Descripción de la Intervención</label>
          <textarea name="description" rows={3} placeholder="Detalle las tareas realizadas..." className="input-field w-full" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="form-group">
            <label className="block text-xs font-black uppercase text-navy-light mb-1">Resultado Final</label>
            <input type="text" name="result" placeholder="Ej: Operativo / Calibrado" required className="input-field w-full" />
          </div>
          
          <div className="form-group">
            <label className="block text-xs font-black uppercase text-navy-light mb-1">Próxima Fecha (Opcional)</label>
            <input type="date" name="next_due_date" className="input-field w-full" />
          </div>
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full mt-4">
          {loading ? "Registrando..." : "Confirmar Registro Técnico"}
        </button>
      </form>
    </div>
  );
}

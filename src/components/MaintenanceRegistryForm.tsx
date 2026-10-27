"use client";

import { useState } from "react";
import { handleMaintenanceAction } from "@/app/dashboard/equipos/actions";
import { getDateKeyInBusinessTimeZone } from "@/lib/dates";

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
    <div className="form-container">
      <h3 className="maintenance-form-heading">Nueva Intervención Técnica</h3>
      <form id="maintenance-form" action={handleSubmit} className="form-fields maintenance-form">
        <input type="hidden" name="equipment_id" value={equipmentId} />
        
        <div className="form-row">
          <div className="form-group">
            <label>Tipo de Actividad</label>
            <select name="type" required>
              <option value="preventive">Mantenimiento Preventivo</option>
              <option value="corrective">Mantenimiento Correctivo</option>
              <option value="calibration">Calibración / Calificación</option>
            </select>
          </div>
          
          <div className="form-group">
            <label>Fecha de realización *</label>
            <input type="date" name="execution_date" required defaultValue={getDateKeyInBusinessTimeZone(new Date())} />
          </div>
        </div>

        <div className="form-group">
            <label>Fecha de mantenimiento (programada) *</label>
            <input type="date" name="scheduled_date" required />
        </div>

        <div className="form-group">
          <label>Técnico / Empresa Responsable</label>
          <input type="text" name="provider_name" placeholder="Ej: Servicio Técnico Abbott o Bioing. Juan Pérez" required />
        </div>

        <div className="form-group">
          <label>Descripción de la Intervención</label>
          <textarea name="description" rows={3} placeholder="Detalle las tareas realizadas..." />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Resultado Final</label>
            <input type="text" name="result" placeholder="Ej: Operativo / Calibrado" required />
          </div>
          
          <div className="form-group">
            <label>Próxima fecha (independiente, opcional)</label>
            <input type="date" name="next_due_date" />
          </div>
        </div>

        <div className="maintenance-form-actions">
          <button type="submit" disabled={loading} className="btn-primary maintenance-submit">
            {loading ? "Registrando..." : "Confirmar Registro Técnico"}
          </button>
        </div>
      </form>
    </div>
  );
}

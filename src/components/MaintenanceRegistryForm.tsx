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
    <div className="form-container">
      <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Nueva Intervención Técnica</h3>
      <form id="maintenance-form" action={handleSubmit}>
        <input type="hidden" name="equipment_id" value={equipmentId} />
        
        <div className="form-row" style={{ marginBottom: '1.5rem' }}>
          <div className="form-group">
            <label>Tipo de Actividad</label>
            <select name="type" required>
              <option value="preventive">Mantenimiento Preventivo</option>
              <option value="corrective">Mantenimiento Correctivo</option>
              <option value="calibration">Calibración / Calificación</option>
            </select>
          </div>
          
          <div className="form-group">
            <label>Fecha de Ejecución</label>
            <input type="date" name="execution_date" required defaultValue={new Date().toISOString().split('T')[0]} />
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
          <label>Técnico / Empresa Responsable</label>
          <input type="text" name="performed_by" placeholder="Ej: Servicio Técnico Abbott o Bioing. Juan Pérez" required />
        </div>

        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
          <label>Descripción de la Intervención</label>
          <textarea name="description" rows={3} placeholder="Detalle las tareas realizadas..." />
        </div>

        <div className="form-row" style={{ marginBottom: '2rem' }}>
          <div className="form-group">
            <label>Resultado Final</label>
            <input type="text" name="result" placeholder="Ej: Operativo / Calibrado" required />
          </div>
          
          <div className="form-group">
            <label>Próxima Fecha (Opcional)</label>
            <input type="date" name="next_due_date" />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" disabled={loading} className="btn-primary" style={{ minWidth: '200px' }}>
            {loading ? "Registrando..." : "Confirmar Registro Técnico"}
          </button>
        </div>
      </form>
    </div>
  );
}

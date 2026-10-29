"use client";

import { useState } from "react";
import DigitalSignature from "@/components/DigitalSignature";
import ContextualHelp from "@/components/ContextualHelp";

interface VerificationFormProps {
  batchId: string;
  action: (formData: FormData) => Promise<void>;
  userName: string;
}

export default function VerificationForm({ batchId, action, userName }: VerificationFormProps) {
  const [seal, setSeal] = useState("");

  return (
    <form action={action} className="form-fields verification-form">
      <input type="hidden" name="batch_id" value={batchId} />
      <input type="hidden" name="verification_seal" value={seal} />
      
      <div className="form-group">
        <label className="verification-label">
          Resultado de Prueba *
          <ContextualHelp 
            content="Al aprobar, el lote sale de cuarentena y queda aceptado para uso. Al fallar, sale de la cola y queda rechazado, sin estar disponible para uso."
          />
        </label>
        <select name="result" required className="form-select">
          <option value="pass">Prueba aprobada (aceptar lote y retirar de pendientes)</option>
          <option value="fail">Prueba fallida (rechazar lote y retirar de pendientes)</option>
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">Lote de Control Usado</label>
        <input type="text" name="control_lot" placeholder="Ej: CTRL-2024-X" className="form-input" />
      </div>

      <div className="form-group">
        <label className="form-label">Observaciones</label>
        <textarea name="observations" rows={2} className="form-textarea"></textarea>
      </div>

      <DigitalSignature 
        userName={userName} 
        onConfirm={setSeal} 
      />
      <div className="verification-help">
        <ContextualHelp 
          content="El código ingresado habilita el envío; la acción se registra con el usuario autenticado."
        />
      </div>

      <button 
        type="submit" 
        disabled={!seal}
        className="btn-primary btn-block"
      >
        Guardar Verificación
      </button>
      {!seal && <p className="verification-signature-hint">Confirma el registro para habilitar el guardado.</p>}
    </form>
  );
}

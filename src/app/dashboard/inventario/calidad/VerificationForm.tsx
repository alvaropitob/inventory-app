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
            content="Según ISO 15189, la liberación técnica requiere que los controles de calidad estén dentro de los rangos establecidos. 'Pasar' moverá el lote de Cuarentena a Aceptado." 
          />
        </label>
        <select name="result" required className="form-select">
          <option value="pass">Aprobado (Liberar para uso)</option>
          <option value="fail">Fallido (Rechazar lote)</option>
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
          content="Esta firma vincula permanentemente tu identidad a esta liberación técnica. El sello generado garantiza la integridad del registro en la auditoría forense." 
        />
      </div>

      <button 
        type="submit" 
        disabled={!seal}
        className="btn-primary btn-block"
      >
        Guardar Verificación
      </button>
      {!seal && <p className="verification-signature-hint">Debe firmar digitalmente para habilitar el guardado.</p>}
    </form>
  );
}

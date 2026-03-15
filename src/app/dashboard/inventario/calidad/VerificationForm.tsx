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
    <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <input type="hidden" name="batch_id" value={batchId} />
      <input type="hidden" name="verification_seal" value={seal} />
      
      <div>
        <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.25rem' }}>
          Resultado de Prueba *
          <ContextualHelp 
            content="Según ISO 15189, la liberación técnica requiere que los controles de calidad estén dentro de los rangos establecidos. 'Pasar' moverá el lote de Cuarentena a Aceptado." 
          />
        </label>
        <select name="result" required style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
          <option value="pass">Aprobado (Liberar para uso)</option>
          <option value="fail">Fallido (Rechazar lote)</option>
        </select>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.25rem' }}>Lote de Control Usado</label>
        <input type="text" name="control_lot" placeholder="Ej: CTRL-2024-X" style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--border)' }} />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.25rem' }}>Observaciones</label>
        <textarea name="observations" rows={2} style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--border)', resize: 'none' }}></textarea>
      </div>

      <DigitalSignature 
        userName={userName} 
        onConfirm={setSeal} 
      />
      <div style={{ marginTop: '-0.5rem', marginBottom: '0.5rem' }}>
        <ContextualHelp 
          content="Esta firma vincula permanentemente tu identidad a esta liberación técnica. El sello generado garantiza la integridad del registro en la auditoría forense." 
        />
      </div>

      <button 
        type="submit" 
        disabled={!seal}
        className="btn-primary" 
        style={{ 
          width: '100%', 
          justifyContent: 'center', 
          padding: '0.75rem',
          opacity: seal ? 1 : 0.5,
          cursor: seal ? 'pointer' : 'not-allowed'
        }}
      >
        Guardar Verificación
      </button>
      {!seal && <p style={{ fontSize: '0.65rem', color: 'red', textAlign: 'center' }}>Debe firmar digitalmente para habilitar el guardado.</p>}
    </form>
  );
}

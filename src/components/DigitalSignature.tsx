"use client";

import { useState } from "react";

interface DigitalSignatureProps {
  onConfirm: (seal: string) => void;
  userName: string;
}

export default function DigitalSignature({ onConfirm, userName }: DigitalSignatureProps) {
  const [isSigned, setIsSigned] = useState(false);
  const [pin, setPin] = useState("");

  const handleSign = () => {
    if (pin.length >= 4) {
      setIsSigned(true);
      // In a real industrial app, this would involve a cryptographic hash or re-auth
      onConfirm(`SIG-${userName.substring(0,3).toUpperCase()}-${Date.now()}`);
    } else {
      alert("Por favor ingrese un PIN o contraseña de al menos 4 dígitos para firmar.");
    }
  };

  return (
    <div className="card" style={{ padding: '1rem', background: '#f8fafc', border: '1px dashed var(--primary-light)', marginTop: '1rem' }}>
      <h4 style={{ fontSize: '0.85rem', color: 'var(--navy)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        🔐 Confirmación de Identidad (ISO 15189)
      </h4>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
        Esta acción será vinculada permanentemente a su usuario: <strong>{userName}</strong>
      </p>

      {!isSigned ? (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input 
            type="password" 
            placeholder="PIN / Contraseña" 
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            style={{ flex: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)', fontSize: '0.85rem' }}
          />
          <button 
            type="button" 
            onClick={handleSign}
            className="btn-primary" 
            style={{ padding: '0.5rem 1rem', fontSize: '0.75rem' }}
          >
            Firmar Digitalmente
          </button>
        </div>
      ) : (
        <div style={{ padding: '0.75rem', background: '#dcfce7', color: '#166534', borderRadius: '4px', fontSize: '0.85rem', fontWeight: '700', textAlign: 'center' }}>
          ✓ Documento Firmado Digitalmente
        </div>
      )}
    </div>
  );
}

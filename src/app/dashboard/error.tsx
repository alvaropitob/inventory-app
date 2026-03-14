"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Dashboard Error Boundary:", error);
  }, [error]);

  return (
    <div className="dashboard-main" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center', padding: '2rem' }}>
      <div style={{ background: '#fee2e2', color: '#dc2626', padding: '1rem', borderRadius: '50%', marginBottom: '1.5rem' }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      
      <h1 style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--navy)', marginBottom: '1rem' }}>Algo salió mal en el servidor</h1>
      
      <p style={{ color: 'var(--text-muted)', maxWidth: '500px', marginBottom: '2rem', lineHeight: '1.6' }}>
        Se ha producido un error durante el renderizado de los componentes del dashboard. 
        {error.digest && (
          <span style={{ display: 'block', marginTop: '0.5rem', fontWeight: '700', fontSize: '0.8rem', color: 'var(--navy-light)' }}>
            Error Digest: {error.digest}
          </span>
        )}
      </p>

      <div style={{ display: 'flex', gap: '1rem' }}>
        <button
          onClick={() => reset()}
          className="btn-primary"
          style={{ padding: '0.75rem 1.5rem', fontSize: '0.9rem', cursor: 'pointer' }}
        >
          Reintentar Carga
        </button>
        <Link 
          href="/dashboard" 
          className="btn-secondary"
          style={{ padding: '0.75rem 1.5rem', fontSize: '0.9rem', textDecoration: 'none' }}
        >
          Volver al Inicio
        </Link>
      </div>

      <div style={{ marginTop: '3rem', padding: '1.5rem', background: 'var(--bg-app)', borderRadius: '12px', textAlign: 'left', width: '100%', maxWidth: '600px', border: '1px solid var(--border)' }}>
        <h3 style={{ fontSize: '0.85rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--navy-light)', marginBottom: '1rem' }}>Detalles técnicos del error</h3>
        <code style={{ fontSize: '0.8rem', color: '#4b5563', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {error.message || "No hay un mensaje de error específico disponible."}
        </code>
      </div>
    </div>
  );
}

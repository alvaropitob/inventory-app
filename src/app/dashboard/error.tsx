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
    <div className="dashboard-main dashboard-error-page">
      <div className="dashboard-error-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      
      <h1 className="page-header-title">Algo salió mal en el servidor</h1>
      
      <p className="dashboard-error-message">
        Se ha producido un error durante el renderizado de los componentes del dashboard. 
        {error.digest && (
          <span className="dashboard-error-digest">
            Error Digest: {error.digest}
          </span>
        )}
      </p>

      <div className="dashboard-error-actions">
        <button
          onClick={() => reset()}
          className="btn-primary"
        >
          Reintentar Carga
        </button>
        <Link 
          href="/dashboard" 
          className="btn-secondary"
          style={{ textDecoration: 'none' }}
        >
          Volver al Inicio
        </Link>
      </div>

      <div className="dashboard-error-details">
        <h2>Detalles técnicos del error</h2>
        <code>
          {error.message || "No hay un mensaje de error específico disponible."}
        </code>
        {error.stack && (
          <details>
            <summary>Ver stack trace (solo desarrollo)</summary>
            <pre>
              {error.stack}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

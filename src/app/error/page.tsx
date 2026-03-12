import Link from "next/link";

export default async function ErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const params = await searchParams;
  const message = params.message || "Ocurrió un error inesperado";

  return (
    <div className="auth-container">
      <div className="auth-bg-orbs">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>

      <div className="auth-card">
        <div className="auth-header">
          <div className="error-icon">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="22" stroke="#ef4444" strokeWidth="3" fill="none" />
              <path d="M24 14v12" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
              <circle cx="24" cy="32" r="2" fill="#ef4444" />
            </svg>
          </div>
          <h1>Algo salió mal</h1>
          <p className="error-message">{message}</p>
        </div>

        <div className="auth-footer" style={{ marginTop: "2rem" }}>
          <Link href="/login" className="auth-button" style={{ display: "block", textAlign: "center" }}>
            Volver al Inicio de Sesión
          </Link>
        </div>
      </div>
    </div>
  );
}

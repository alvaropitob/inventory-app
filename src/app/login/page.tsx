import { signInWithGoogle } from "./actions";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="10" fill="url(#logo-grad)" />
              <path d="M12 28V12h4l4 8 4-8h4v16h-4V19l-4 7-4-7v9h-4z" fill="white" />
              <defs>
                <linearGradient id="logo-grad" x1="0" y1="0" x2="40" y2="40">
                  <stop stopColor="#0ea5e9" />
                  <stop offset="1" stopColor="#0284c7" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h1>Bienvenido</h1>
          <p>Inicia sesión en el portal clínico usando tu cuenta de Google</p>
        </div>

        <form className="auth-form">
          <button formAction={signInWithGoogle} className="google-button" type="submit" style={{ marginTop: '1rem' }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Iniciar sesión con Google
          </button>
        </form>

        <div className="auth-footer">
          <p>
            ¿No tienes una cuenta?{" "}
            <Link href="/register">Regístrate</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

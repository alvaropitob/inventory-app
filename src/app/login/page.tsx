"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import AuthBrand from "@/components/AuthBrand";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get("access") === "pending") {
      setStatusMsg("Tu cuenta está pendiente de aprobación o no tiene acceso activo. Contacta al administrador de Nexo Clínico.");
    } else if (query.get("access") === "gmail-only") {
      setStatusMsg("El registro solo admite cuentas Google con dirección @gmail.com.");
    } else if (query.get("password") === "updated") {
      setStatusMsg("Contraseña actualizada. Ya puedes iniciar sesión.");
    }
    if (query.get("error") === "credentials") {
      setErrorMsg("No se pudo iniciar sesión. Verifica el correo y la contraseña.");
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMsg("No se pudo iniciar sesión. Verifica el correo y la contraseña.");
        setLoading(false);
        return;
      }

      const accessResponse = await fetch("/api/auth/access", { cache: "no-store" });
      if (!accessResponse.ok) {
        await supabase.auth.signOut();
        setStatusMsg("Tu cuenta está pendiente de aprobación o no tiene acceso activo. Contacta al administrador de Nexo Clínico.");
        setLoading(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error inesperado al iniciar sesión";
      setErrorMsg(message);
      setLoading(false);
    }
  };

  const handlePasswordRecovery = async () => {
    setErrorMsg(null);
    setStatusMsg(null);
    if (!email.trim()) {
      setErrorMsg("Escribe tu correo institucional para enviarte el enlace de recuperación.");
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
      });
      if (error) throw error;
      setStatusMsg("Si el correo corresponde a una cuenta, recibirás instrucciones para restablecer la contraseña.");
    } catch {
      setStatusMsg("Si el correo corresponde a una cuenta, recibirás instrucciones para restablecer la contraseña.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    try {
      const supabase = createClient();
      const origin = typeof window !== "undefined" ? window.location.origin : "https://inventory-app-three-alpha.vercel.app";
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback`,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (error) {
        setErrorMsg(error.message);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error con Google Login";
      setErrorMsg(message);
    }
  };

  return (
    <main className="auth-container auth-login-page">
      <section className="auth-card auth-login-card" aria-labelledby="login-title">
        <div className="auth-header">
          <AuthBrand />
          <h1 id="login-title">Bienvenido</h1>
          <p>Inicia sesión para continuar con tu espacio de trabajo.</p>
        </div>

        {errorMsg && (
          <div className="auth-notice auth-notice-error" role="alert">
            {errorMsg}
          </div>
        )}
        {statusMsg && <div className="auth-notice auth-notice-status" role="status">{statusMsg}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Correo electrónico</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              disabled={loading}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={loading}
            />
          </div>

          <button className="auth-button" type="submit" disabled={loading}>
            {loading ? "Iniciando sesión..." : "Iniciar sesión"}
          </button>
        </form>
        <div className="auth-recovery-row">
          <button type="button" onClick={handlePasswordRecovery} disabled={loading} className="auth-text-button">
            {loading ? "Procesando..." : "¿Olvidaste tu contraseña?"}
          </button>
        </div>

        <div className="auth-divider"><span>o continúa con</span></div>

        <div className="auth-google-action">
          <button onClick={handleGoogleLogin} className="google-button auth-google-button" type="button" disabled={loading}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Continuar con Google
          </button>
        </div>

        <div className="auth-footer">
          <p className="auth-security-note"><span aria-hidden="true">●</span> Acceso exclusivo para personal autorizado</p>
          <p>¿Aún no tienes cuenta? <Link href="/register">Solicitar acceso con Google</Link></p>
        </div>
      </section>
    </main>
  );
}

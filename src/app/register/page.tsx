"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("error") === "gmail-only") {
      setError("El registro solo permite cuentas de Google con dirección @gmail.com.");
    }
  }, []);

  async function registerWithGoogle() {
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: { prompt: "select_account", hd: "gmail.com" },
        },
      });
      if (authError) {
        if (/gmail|provider|signup/i.test(authError.message)) {
          setError("El registro solo admite cuentas Google con dirección @gmail.com.");
          setLoading(false);
          return;
        }
        throw authError;
      }
    } catch {
      setError("No se pudo iniciar el registro con Google. Inténtalo de nuevo o contacta al administrador.");
      setLoading(false);
    }
  }

  return (
    <main className="auth-container">
      <section className="auth-card" aria-labelledby="access-title">
        <div className="auth-header">
          <div className="auth-logo">
            <Image src="/medicore-clinical-logo.svg" alt="Logotipo MediCore" width={84} height={84} priority />
          </div>
          <h1 id="access-title">Registro institucional</h1>
          <p>Regístrate con tu cuenta de Google para solicitar acceso a MediCore.</p>
        </div>
        {error && <p className="alert-error" role="alert">{error}</p>}
        <button onClick={registerWithGoogle} className="google-button" type="button" disabled={loading}>
          <span aria-hidden="true" style={{ fontWeight: 700, fontSize: "1.2rem", color: "#4285F4", marginRight: ".5rem" }}>G</span>
          {loading ? "Conectando con Google..." : "Continuar con Google"}
        </button>
        <div className="auth-footer">
          <p>El registro no activa el acceso al inventario. Un administrador debe aprobar la cuenta y asignar su rol.</p>
          <p><Link href="/login">Volver al inicio de sesión</Link></p>
        </div>
      </section>
    </main>
  );
}

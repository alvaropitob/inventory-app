"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AuthBrand from "@/components/AuthBrand";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password.length < 12) {
      setError("Usa una contraseña de al menos 12 caracteres.");
      return;
    }
    if (password !== confirmation) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError("No se pudo actualizar la contraseña. Solicita un nuevo enlace e inténtalo otra vez.");
      setLoading(false);
      return;
    }

    await supabase.auth.signOut();
    router.replace("/login?password=updated");
    router.refresh();
  }

  return (
    <main className="auth-container">
      <section className="auth-card" aria-labelledby="reset-title">
        <div className="auth-header">
          <AuthBrand />
          <h1 id="reset-title">Restablecer contraseña</h1>
          <p>Elige una contraseña nueva para tu cuenta institucional.</p>
        </div>
        {error && <p className="alert-error" role="alert">{error}</p>}
        <form className="auth-form" onSubmit={submit}>
          <div className="form-group">
            <label htmlFor="new-password">Nueva contraseña</label>
            <input id="new-password" type="password" autoComplete="new-password" minLength={12} required value={password} onChange={event => setPassword(event.target.value)} disabled={loading} />
          </div>
          <div className="form-group">
            <label htmlFor="confirm-password">Confirmar contraseña</label>
            <input id="confirm-password" type="password" autoComplete="new-password" minLength={12} required value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={loading} />
          </div>
          <button className="auth-button" type="submit" disabled={loading}>{loading ? "Actualizando..." : "Guardar contraseña"}</button>
        </form>
      </section>
    </main>
  );
}

import { createClient } from "@/lib/supabase/server";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase/config";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home() {
  const url = SUPABASE_URL;
  const key = SUPABASE_ANON_KEY;

  if (!url || !key) {
    return (
      <div className="system-message-page system-message-error">
        <section className="system-message-card">
        <h1>Error de configuración</h1>
        <p>No se encontraron las variables de entorno necesarias para conectar con Supabase.</p>
        <p>Configura <b>NEXT_PUBLIC_SUPABASE_URL</b> y <b>NEXT_PUBLIC_SUPABASE_ANON_KEY</b> en el entorno de ejecución.</p>
        </section>
      </div>
    );
  }

  let shouldRedirectToDashboard = false;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();

    if (data?.user && !error) {
      shouldRedirectToDashboard = true;
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : JSON.stringify(e);
    return (
      <div className="system-message-page system-message-warning">
        <section className="system-message-card">
        <h1>Error de conexión</h1>
        <p>No se pudo verificar la sesión. Revisa que el proyecto de Supabase esté ACTIVO.</p>
        <pre>{message}</pre>
        </section>
      </div>
    );
  }

  if (shouldRedirectToDashboard) {
    redirect("/dashboard");
  } else {
    redirect("/login");
  }
}

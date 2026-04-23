import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return (
      <div style={{ padding: "50px", textAlign: "center", fontFamily: "sans-serif", color: "red" }}>
        <h1>Error de Configuración</h1>
        <p>No se encontraron las variables de entorno en Vercel.</p>
        <p>Asegúrate de haber añadido <b>NEXT_PUBLIC_SUPABASE_URL</b> y <b>NEXT_PUBLIC_SUPABASE_ANON_KEY</b> en los Settings de Vercel.</p>
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
      <div style={{ padding: "50px", textAlign: "center", fontFamily: "sans-serif", color: "orange" }}>
        <h1>Error de Conexión con Supabase</h1>
        <p>No se pudo verificar la sesión. Revisa que el proyecto de Supabase esté ACTIVO.</p>
        <pre style={{ background: "#eee", padding: "10px" }}>{message}</pre>
      </div>
    );
  }

  if (shouldRedirectToDashboard) {
    redirect("/dashboard");
  } else {
    redirect("/login");
  }
}

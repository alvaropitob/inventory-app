import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return (
      <div style={{ padding: "20px", color: "red" }}>
        <h1>Error de Configuración</h1>
        <p>Faltan las variables de entorno NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en Vercel.</p>
      </div>
    );
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data?.user) {
      redirect("/login");
    }

    redirect("/dashboard");
  } catch (e) {
    return (
      <div style={{ padding: "20px", color: "red" }}>
        <h1>Error de Conexión</h1>
        <p>No se pudo conectar con Supabase. Verifica que el proyecto no esté pausado.</p>
        <pre>{JSON.stringify(e, null, 2)}</pre>
      </div>
    );
  }
}

import { NextResponse } from "next/server";
import { headers } from "next/headers";

export async function GET() {
  const headersList = await headers();
  const host = headersList.get("host");
  const forwardedHost = headersList.get("x-forwarded-host");
  const protocol = headersList.get("x-forwarded-proto") || "http";
  
  const origin = forwardedHost ? `${protocol}://${forwardedHost}` : host ? `${protocol}://${host}` : "Unknown";

  return NextResponse.json({
    message: "Diagnóstico de URL para Autenticación",
    detected_origin: origin,
    headers: {
      host,
      "x-forwarded-host": forwardedHost,
      "x-forwarded-proto": protocol,
    },
    env: {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: process.env.VERCEL || "false",
    },
    recommendation: `Asegúrate de que '${origin}' esté configurado como 'Site URL' en tu Dashboard de Supabase.`
  });
}

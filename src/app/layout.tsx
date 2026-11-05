import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nexo Clínico V1 | Gestión clínica integral",
  description: "Nexo Clínico integra inventario, pedidos, calidad, equipos y monitoreo para la operación clínica.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}

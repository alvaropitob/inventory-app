"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import Sidebar from "./Sidebar";

interface DashboardClientLayoutProps {
  children: React.ReactNode;
  user: {
    fullName: string;
    email: string;
    avatarUrl: string | null;
    role: string;
  };
}

export default function DashboardClientLayout({ children, user }: DashboardClientLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const pageTitles: Array<[string, string]> = [
    ["/dashboard/inventario/calidad", "Control de calidad"],
    ["/dashboard/pedidos/nuevo", "Nueva orden de compra"],
    ["/dashboard/proveedores/evaluacion", "Evaluación de proveedores"],
    ["/dashboard/seguridad/reportar", "Reporte de incidente"],
    ["/dashboard/auditoria/checklist", "Checklist de cumplimiento"],
    ["/dashboard/auditoria/cumplimiento", "Cumplimiento normativo"],
    ["/dashboard/inventario", "Inventario y lotes"],
    ["/dashboard/recepcion", "Recepción técnica"],
    ["/dashboard/pedidos", "Órdenes de compra"],
    ["/dashboard/proveedores", "Proveedores"],
    ["/dashboard/monitoreo", "Monitoreo ambiental"],
    ["/dashboard/equipos", "Equipos"],
    ["/dashboard/reportes", "Reportes"],
    ["/dashboard/auditoria", "Auditoría"],
    ["/dashboard/usuarios", "Usuarios"],
    ["/dashboard/configuracion", "Configuración"],
    ["/dashboard/seguridad", "Seguridad clínica"],
    ["/dashboard", "Panel operativo"],
  ];
  const pageTitle = pageTitles.find(([path]) => pathname.startsWith(path))?.[1] ?? "Panel operativo";

  return (
    <div className="dashboard-layout">
      {/* Mobile Header */}
      <header className="mobile-header">
        <button 
          className="mobile-menu-toggle"
          onClick={() => setIsMobileMenuOpen(true)}
          aria-label="Abrir menú"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <span className="mobile-logo-text">MediCore <small>Inventario clínico</small></span>
      </header>

      <Sidebar 
        user={user} 
        isMobileOpen={isMobileMenuOpen} 
        onClose={() => setIsMobileMenuOpen(false)} 
      />
      
      <AnimatePresence mode="wait">
        <motion.main 
          key={pathname}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="dashboard-content"
        >
          <header className="desktop-topbar">
            <div className="topbar-breadcrumb" aria-label="Ruta de navegación">
              <span>Operación clínica</span>
              <ChevronRight aria-hidden="true" size={15} />
              <strong>{pageTitle}</strong>
            </div>
            <div className="topbar-actions">
              <span className="topbar-role">{user.role}</span>
              <span className="topbar-avatar" aria-hidden="true">{user.fullName.trim().charAt(0).toUpperCase()}</span>
              <Link href="/dashboard/inventario" className="topbar-link">Ver inventario</Link>
            </div>
          </header>
          {children}
        </motion.main>
      </AnimatePresence>
    </div>
  );
}

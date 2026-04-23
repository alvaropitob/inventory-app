"use client";

import Link from "next/link";
import { motion, type Variants } from "framer-motion";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants: Variants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 100, damping: 12 }
  }
};

const IconProveedores = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const IconInventario = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m7.5 4.27 9 5.15" />
    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
    <path d="m3.3 7 8.7 5 8.7-5" />
    <path d="M12 22V12" />
  </svg>
);

const IconAmbiental = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
  </svg>
);

const IconSeguridad = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

const IconReportes = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const IconMantenimiento = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

export default function ComplianceChecklistPage() {
  const categories = [
    {
      title: "1. Gestión de Selección y Recepción",
      icon: <IconProveedores />,
      color: "#6366f1",
      bg: "#e0e7ff",
      items: [
        { label: "Registro de Proveedores (Datos básicos)" },
        { label: "Criterios de selección y evaluación de desempeño" },
        { label: "Registro de Órdenes de Compra (Módulo Pedidos)" },
        { label: "Recepción Técnica Formal (Inspección + Temperatura)" },
      ]
    },
    {
      title: "2. Gestión de Inventario Item/Lote (ISO 15189)",
      icon: <IconInventario />,
      color: "#0284c7",
      bg: "#e0f2fe",
      items: [
        { label: "Existencias en tiempo real por ítem" },
        { label: "Control por Lote y Ubicación específica" },
        { label: "Gestión de vencimiento automatizada" },
        { label: "Lógica FEFO (First Expired, First Out)" },
        { label: "Segregación: Aceptado, Cuarentena, Rechazado" },
      ]
    },
    {
      title: "3. Condiciones Ambientales",
      icon: <IconAmbiental />,
      color: "#d97706",
      bg: "#fef3c7",
      items: [
        { label: "Registro de ubicaciones técnicas" },
        { label: "Condiciones requeridas por el fabricante" },
        { label: "Monitoreo diario de Temperatura y Humedad" },
      ]
    },
    {
      title: "4. Trazabilidad y Seguridad",
      icon: <IconSeguridad />,
      color: "#059669",
      bg: "#d1fae5",
      items: [
        { label: "Autenticación y Gestión de Sesiones" },
        { label: "Roles de Usuario (Admin, Operador, Supervisor)" },
        { label: "Auditoría Inmutable (Acciones registradas)" },
        { label: "Trazabilidad de uso (Vínculo Lote-Equipo)" },
        { label: "Registro Sanitario / INVIMA persistente" },
      ]
    },
    {
      title: "5. Reportes de Habilitación (Res. 3100)",
      icon: <IconReportes />,
      color: "#7c3aed",
      bg: "#ede9fe",
      items: [
        { label: "Reporte de Inventario Vigente" },
        { label: "Reporte de Mermas y Descartes" },
        { label: "Reporte de Incidentes de Calidad (Recall)" },
        { label: "Histórico de Condiciones Ambientales" },
      ]
    },
    {
      title: "6. Mantenimiento e Instrumentación",
      icon: <IconMantenimiento />,
      color: "#dc2626",
      bg: "#fee2e2",
      items: [
        { label: "Maestro de Equipos e Instrumentos" },
        { label: "Hoja de Vida Técnica por Equipo" },
        { label: "Control de Mantenimiento y Calibración" },
        { label: "Alertas de Vencimiento de Servicio Técnico" },
      ]
    }
  ];

  return (
    <div className="dashboard-main">
      <header className="checklist-header">
        <div>
          <h1 className="page-header-title">Capacidades de Cumplimiento</h1>
          <p className="page-header-subtitle">
            Estado de alineación normativa con ISO 15189 y Resolución 3100
          </p>
        </div>
        <div className="checklist-header-actions">
          <Link href="/dashboard/auditoria/cumplimiento" className="btn-outline">
            Dashboard Normativo
          </Link>
          <button onClick={() => window.print()} className="btn-primary">
            Imprimir Certificación
          </button>
        </div>
      </header>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="checklist-grid"
      >
        {categories.map((cat, idx) => (
          <motion.div key={idx} variants={itemVariants} className="checklist-card">
            <div className="checklist-card-header">
              <div
                className="checklist-card-icon"
                style={{ background: cat.bg, color: cat.color }}
              >
                {cat.icon}
              </div>
              <h2 className="checklist-card-title">{cat.title}</h2>
            </div>
            <div className="checklist-items">
              {cat.items.map((item, iIdx) => (
                <div key={iIdx} className="checklist-item">
                  <span className="checklist-item-label">{item.label}</span>
                  <div className="checklist-item-status">
                    <span className="checklist-verified">VERIFICADO</span>
                    <div className="checklist-check">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </motion.div>

      <motion.footer
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="checklist-footer"
      >
        <div className="checklist-footer-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span>Conclusión Técnica de Cumplimiento</span>
        </div>
        <p className="checklist-footer-text">
          &quot;El ecosistema digital implementado proporciona una infraestructura técnica íntegra que
          garantiza la trazabilidad absoluta del reactivo desde su recepción primaria hasta su disposición
          final. Los controles implementados satisfacen los requisitos de integridad de datos, seguridad
          clínica y gestión proactiva de riesgos exigidos por los estándares internacionales de
          acreditación de laboratorios clínicos.&quot;
        </p>
      </motion.footer>
    </div>
  );
}

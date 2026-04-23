"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
} as const;

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 100, damping: 12 }
  }
} as const;

export default function ComplianceChecklistPage() {
  const categories = [
    {
      title: "1. Gestión de Selección y Recepción",
      icon: "🤝",
      items: [
        { label: "Registro de Proveedores (Datos básicos)" },
        { label: "Criterios de selección y evaluación de desempeño" },
        { label: "Registro de Órdenes de Compra (Módulo Pedidos)" },
        { label: "Recepción Técnica Formal (Inspección + Temperatura)" },
      ]
    },
    {
      title: "2. Gestión de Inventario Item/Lote (ISO 15189)",
      icon: "📦",
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
      icon: "🌡️",
      items: [
        { label: "Registro de ubicaciones técnicas" },
        { label: "Condiciones requeridas por el fabricante" },
        { label: "Monitoreo diario de Temperatura y Humedad" },
      ]
    },
    {
      title: "4. Trazabilidad y Seguridad",
      icon: "🛡️",
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
      icon: "📊",
      items: [
        { label: "Reporte de Inventario Vigente" },
        { label: "Reporte de Mermas y Descartes" },
        { label: "Reporte de Incidentes de Calidad (Recall)" },
        { label: "Histórico de Condiciones Ambientales" },
      ]
    },
    {
      title: "6. Mantenimiento e Instrumentación",
      icon: "🔬",
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
              <span className="checklist-card-icon">{cat.icon}</span>
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

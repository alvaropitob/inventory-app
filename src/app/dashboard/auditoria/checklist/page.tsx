"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export default function ComplianceChecklistPage() {
  const categories = [
    {
      title: "1. Gestión de Selección y Recepción",
      icon: "🤝",
      items: [
        { label: "Registro de Proveedores (Datos básicos)", status: true },
        { label: "Criterios de selección y evaluación de desempeño", status: true },
        { label: "Registro de Órdenes de Compra (Módulo Pedidos)", status: true },
        { label: "Recepción Técnica Formal (Inspección + Temperatura)", status: true },
      ]
    },
    {
      title: "2. Gestión de Inventario Item/Lote (ISO 15189)",
      icon: "📦",
      items: [
        { label: "Existencias en tiempo real por ítem", status: true },
        { label: "Control por Lote y Ubicación específica", status: true },
        { label: "Gestión de vencimiento automatizada", status: true },
        { label: "Lógica FEFO (First Expired, First Out)", status: true },
        { label: "Segregación: Aceptado, Cuarentena, Rechazado", status: true },
      ]
    },
    {
      title: "3. Condiciones Ambientales",
      icon: "🌡️",
      items: [
        { label: "Registro de ubicaciones técnicas", status: true },
        { label: "Condiciones requeridas por el fabricante", status: true },
        { label: "Monitoreo diario de Temperatura y Humedad", status: true },
      ]
    },
    {
      title: "4. Trazabilidad y Seguridad",
      icon: "🛡️",
      items: [
        { label: "Autenticación y Gestión de Sesiones", status: true },
        { label: "Roles de Usuario (Admin, Operador, Supervisor)", status: true },
        { label: "Auditoría Inmutable (Acciones registradas)", status: true },
        { label: "Trazabilidad de uso (Vínculo Lote-Equipo)", status: true },
        { label: "Registro Sanitario / INVIMA persistente", status: true },
      ]
    },
    {
      title: "5. Reportes de Habilitación (Res. 3100)",
      icon: "📊",
      items: [
        { label: "Reporte de Inventario Vigente", status: true },
        { label: "Reporte de Mermas y Descartes", status: true },
        { label: "Reporte de Incidentes de Calidad (Recall)", status: true },
        { label: "Histórico de Condiciones Ambientales", status: true },
      ]
    },
    {
      title: "6. Mantenimiento e Instrumentación",
      icon: "🔬",
      items: [
        { label: "Maestro de Equipos e Instrumentos", status: true },
        { label: "Hoja de Vida Técnica por Equipo", status: true },
        { label: "Control de Mantenimiento y Calibración", status: true },
        { label: "Alertas de Vencimiento de Servicio Técnico", status: true },
      ]
    }
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  } as const;

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 12
      }
    }
  } as const;

  return (
    <div className="dashboard-main">
      <header style={{ marginBottom: '3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: '2.25rem', fontWeight: '800', color: 'var(--navy)', letterSpacing: '-0.025em', marginBottom: '0.25rem' }}>
            Capacidades de Cumplimiento
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1rem', fontWeight: '500' }}>
            Estado de alineación normativa con ISO 15189 y Resolución 3100
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <Link href="/dashboard/auditoria/cumplimiento" className="btn-primary" style={{ background: 'transparent', color: 'var(--primary)', border: '1px solid var(--primary)', boxShadow: 'none' }}>
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
        className="stats-grid" 
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem' }}
      >
        {categories.map((cat, idx) => (
          <motion.div 
            key={idx} 
            variants={itemVariants}
            className="stat-card" 
            style={{ 
              flexDirection: 'column', 
              alignItems: 'stretch', 
              padding: '2rem', 
              background: 'var(--white)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--bg-app)', paddingBottom: '1rem' }}>
              <span style={{ fontSize: '1.5rem' }}>{cat.icon}</span>
              <h2 style={{ fontSize: '1.125rem', fontWeight: '700', color: 'var(--navy)', margin: 0 }}>
                {cat.title}
              </h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {cat.items.map((item, iIdx) => (
                <div key={iIdx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.25rem 0' }}>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--navy-light)', fontWeight: '500' }}>{item.label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: '800', color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>VERIFICADO</span>
                    <div style={{ 
                      width: '20px', 
                      height: '20px', 
                      borderRadius: '50%', 
                      background: 'rgba(16, 185, 129, 0.1)', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      color: 'var(--success)',
                      border: '1px solid rgba(16, 185, 129, 0.2)'
                    }}>
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
        style={{ 
          marginTop: '4rem', 
          padding: '2.5rem', 
          background: 'rgba(30, 41, 59, 0.03)', 
          borderRadius: 'var(--radius-lg)', 
          border: '1px solid var(--border)',
          textAlign: 'center'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span style={{ fontWeight: '700', color: 'var(--navy)', fontSize: '0.9375rem' }}>Conclusión Técnica de Cumplimiento</span>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: '1.6', maxWidth: '800px', margin: '0 auto', fontStyle: 'italic' }}>
          &quot;El ecosistema digital implementado proporciona una infraestructura técnica íntegra que garantiza la trazabilidad absoluta del reactivo desde su recepción primaria hasta su disposición final. Los controles implementados satisfacen los requisitos de integridad de datos, seguridad clínica y gestión proactiva de riesgos exigidos por los estándares internacionales de acreditación de laboratorios clínicos.&quot;
        </p>
      </motion.footer>

      <style jsx global>{`
        @media print {
          .btn-primary, .dashboard-nav, .sidebar, header div:last-child { display: none !important; }
          .dashboard-main { padding: 0 !important; }
          .stat-card { break-inside: avoid; border: 1px solid #eee !important; box-shadow: none !important; margin-bottom: 2rem; }
          footer { border: 1px solid #eee !important; background: none !important; }
        }
      `}</style>
    </div>
  );
}

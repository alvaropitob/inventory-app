'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

interface Equipment {
  id: string;
  name: string;
  next_preventive_maintenance?: string | null;
}

interface Props {
  data: {
    totalEquipments: number;
    equipmentsInMaintenance: number;
    pendingQuality: number;
    complianceIndex: number;
    urgentMaintenance: Equipment[];
  };
}

export default function AuditDashboardUI({ data }: Props) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

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
      <motion.header 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        style={{ marginBottom: '3rem' }}
      >
        <h1 style={{ fontSize: '2.25rem', fontWeight: '800', color: 'var(--navy)', letterSpacing: '-0.025em', marginBottom: '0.5rem' }}>
          Centro de Control Normativo
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', fontWeight: '500' }}>
          Consolidado técnico de evidencias para Habilitación y ISO 15189
        </p>
      </motion.header>

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="stats-grid"
        style={{ marginBottom: '3rem' }}
      >
        {/* KPI 1: Equipos */}
        <motion.div variants={itemVariants} className="stat-card" style={{ borderTop: '4px solid var(--primary)' }}>
          <div className="stat-icon" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>⚙️</div>
          <div className="stat-info">
            <h3>{data.totalEquipments - data.equipmentsInMaintenance} / {data.totalEquipments}</h3>
            <p>Equipos Operativos</p>
          </div>
        </motion.div>

        {/* KPI 2: Alertas */}
        <motion.div variants={itemVariants} className="stat-card" style={{ borderTop: '4px solid var(--warning)' }}>
          <div className="stat-icon" style={{ background: '#fff7ed', color: 'var(--warning)' }}>⚠️</div>
          <div className="stat-info">
            <h3>{data.pendingQuality}</h3>
            <p>Alertas de Calidad</p>
          </div>
        </motion.div>

        {/* KPI 3: Cumplimiento */}
        <motion.div variants={itemVariants} className="stat-card" style={{ borderTop: '4px solid var(--success)' }}>
          <div className="stat-icon" style={{ background: '#f0fdf4', color: 'var(--success)' }}>🛡️</div>
          <div className="stat-info">
            <h3>{data.complianceIndex}%</h3>
            <p>Índice de Cumplimiento</p>
          </div>
        </motion.div>
      </motion.div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '2.5rem' }}>
        {/* Mantenimientos */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="stat-card" 
          style={{ flexDirection: 'column', alignItems: 'stretch', padding: '2.5rem' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--navy)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ color: 'var(--error)' }}>⚡</span> Alertas de Mantenimiento
            </h2>
            <Link href="/dashboard/equipos" style={{ fontSize: '0.8125rem', color: 'var(--primary)', fontWeight: '700', textDecoration: 'none' }}>Ver todos →</Link>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {data.urgentMaintenance.length > 0 ? (
              data.urgentMaintenance.map((eq) => (
                <div key={eq.id} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  padding: '1.25rem', 
                  background: '#fef2f2', 
                  borderRadius: 'var(--radius)', 
                  border: '1px solid #fee2e2' 
                }}>
                  <div>
                    <div style={{ fontWeight: '700', color: '#991b1b', fontSize: '0.9375rem' }}>{eq.name}</div>
                    <div style={{ fontSize: '0.8125rem', color: '#b91c1c', opacity: 0.8 }}>
                      Programado: {new Date(eq.next_preventive_maintenance!).toLocaleDateString()}
                    </div>
                  </div>
                  <Link href={`/dashboard/equipos/${eq.id}`} className="btn-primary" style={{ 
                    padding: '0.5rem 1rem', 
                    fontSize: '0.75rem', 
                    background: 'white', 
                    color: '#991b1b', 
                    border: '1px solid #fca5a5',
                    boxShadow: 'none'
                  }}>
                    Gestionar
                  </Link>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No hay mantenimientos críticos pendientes.
              </div>
            )}
          </div>
        </motion.div>

        {/* Sentinel Indicator */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="stat-card" 
          style={{ 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            padding: '3rem', 
            textAlign: 'center',
            background: 'linear-gradient(to bottom, var(--white), var(--bg-app))'
          }}
        >
          <div style={{ 
            width: '120px', 
            height: '120px', 
            borderRadius: '50%', 
            background: 'var(--primary-light)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            marginBottom: '1.5rem',
            position: 'relative'
          }}>
             <motion.div 
               animate={{ scale: [1, 1.1, 1] }}
               transition={{ duration: 3, repeat: Infinity }}
               style={{ position: 'absolute', width: '100%', height: '100%', borderRadius: '50%', border: '2px solid var(--primary)', opacity: 0.2 }}
             />
             <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
               <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
               <circle cx="12" cy="12" r="3" />
             </svg>
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--navy)', marginBottom: '0.75rem' }}>Estatus Audit-Ready</h2>
          <p style={{ fontSize: '0.9375rem', color: 'var(--text-muted)', maxWidth: '280px', lineHeight: '1.5', marginBottom: '2rem' }}>
            Su laboratorio cumple con el 96.4% de los puntos de control para Habilitación.
          </p>
          <Link href="/dashboard/auditoria/checklist" className="btn-primary" style={{ width: '100%' }}>
            Ver Checklist de Cumplimiento
          </Link>
        </motion.div>
      </div>

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        style={{ marginTop: '4rem', padding: '2rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <div style={{ display: 'flex', gap: '2rem' }}>
           <div>
              <div style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-subtle)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Última Auditoría</div>
              <div style={{ fontSize: '0.9375rem', fontWeight: '700', color: 'var(--navy)' }}>14 Marzo, 2026</div>
           </div>
           <div>
              <div style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-subtle)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Responsable</div>
              <div style={{ fontSize: '0.9375rem', fontWeight: '700', color: 'var(--navy)' }}>Dr. Alvaro P.</div>
           </div>
        </div>
        <Link href="/dashboard/auditoria" style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          Registro completo de auditoría <span style={{ fontSize: '1.2rem' }}>→</span>
        </Link>
      </motion.div>
    </div>
  );
}

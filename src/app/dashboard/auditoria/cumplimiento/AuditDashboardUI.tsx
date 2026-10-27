'use client';

import Link from 'next/link';
import { motion, type Variants } from 'framer-motion';
import { Activity, AlertTriangle, Clock3, Zap } from 'lucide-react';

interface Equipment {
  id: string;
  name: string;
  next_preventive_maintenance?: string | null;
}

interface Props {
  data: {
    totalEquipments: number;
    operationalEquipments: number;
    pendingQuality: number;
    equipmentsWithCurrentMaintenance: number;
    maintenanceCompliance: number | null;
    equipmentDataAvailable: boolean;
    urgentMaintenance: Equipment[];
  };
}

export default function AuditDashboardUI({ data }: Props) {
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
  const maintenanceAccent = data.maintenanceCompliance === null
    ? "kpi-accent-primary"
    : data.maintenanceCompliance >= 90
      ? "kpi-accent-success"
      : "kpi-accent-warning";

  return (
    <div className="dashboard-main">
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="page-header">
        <div>
          <h1 className="page-header-title">Centro de Control Normativo</h1>
          <p className="page-header-subtitle">
            Consolidado técnico de evidencias para Habilitación y ISO 15189
          </p>
        </div>
      </motion.div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="stats-grid audit-stats-grid"
      >
        <motion.div variants={itemVariants} className="stat-card kpi-accent-primary">
          <div className="stat-icon stat-icon-primary"><Activity className="ui-icon" aria-hidden="true" /></div>
          <div className="stat-info">
            <h3>{data.operationalEquipments} / {data.totalEquipments}</h3>
            <p>Equipos Operativos</p>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="stat-card kpi-accent-warning">
          <div className="stat-icon stat-icon-warning"><AlertTriangle className="ui-icon" aria-hidden="true" /></div>
          <div className="stat-info">
            <h3>{data.pendingQuality}</h3>
            <p>Alertas de Calidad</p>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className={`stat-card ${maintenanceAccent}`}>
          <div className="stat-icon stat-icon-primary"><Clock3 className="ui-icon" aria-hidden="true" /></div>
          <div className="stat-info">
            <h3>{data.maintenanceCompliance === null ? "N/D" : `${data.maintenanceCompliance.toFixed(1)}%`}</h3>
            <p>Mantenimiento preventivo vigente</p>
          </div>
        </motion.div>
      </motion.div>

      <div className="audit-panel-grid">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="audit-panel"
        >
          <div className="audit-panel-header">
            <h2 className="audit-panel-title">
              <Zap className="ui-icon" style={{ color: 'var(--error)' }} aria-hidden="true" /> Alertas de Mantenimiento
            </h2>
            <Link href="/dashboard/equipos" className="audit-panel-link">Ver todos →</Link>
          </div>

          <div className="maintenance-list">
            {data.urgentMaintenance.length > 0 ? (
              data.urgentMaintenance.map((eq) => (
                <div key={eq.id} className="maintenance-item">
                  <div>
                    <div className="maintenance-item-name">{eq.name}</div>
                    <div className="maintenance-item-date">
                      Programado: {new Date(eq.next_preventive_maintenance!).toLocaleDateString()}
                    </div>
                  </div>
                  <Link href={`/dashboard/equipos/${eq.id}`} className="btn-maintenance">
                    Gestionar
                  </Link>
                </div>
              ))
            ) : (
              <p style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No hay mantenimientos críticos pendientes.
              </p>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="sentinel-panel"
        >
          <div className="sentinel-orb">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 3, repeat: Infinity }}
              className="sentinel-orb-ring"
            />
            <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </div>
          <h2 className="sentinel-title">Cobertura de mantenimiento preventivo</h2>
          <p className="sentinel-desc">
            {data.maintenanceCompliance === null
              ? data.equipmentDataAvailable
                ? "No hay equipos registrados para calcular este indicador."
                : "No se pudo consultar el registro de equipos; el indicador no está disponible."
              : `${data.equipmentsWithCurrentMaintenance} de ${data.totalEquipments} equipos tienen estado activo y una fecha de mantenimiento preventivo vigente. El porcentaje se calcula sobre todos los equipos registrados; los que no tienen fecha vigente no cuentan como cubiertos.`}
          </p>
          <Link href="/dashboard/auditoria/checklist" className="btn-primary btn-block">
            Ver Checklist de Cumplimiento
          </Link>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="audit-meta"
      >
        <div className="audit-meta-fields">
          <div>
            <div className="audit-meta-label">Última Auditoría</div>
            <div className="audit-meta-value">14 Marzo, 2026</div>
          </div>
          <div>
            <div className="audit-meta-label">Responsable</div>
            <div className="audit-meta-value">Dr. Alvaro P.</div>
          </div>
        </div>
        <Link href="/dashboard/auditoria" className="audit-meta-link">
          Registro completo de auditoría <span>→</span>
        </Link>
      </motion.div>
    </div>
  );
}

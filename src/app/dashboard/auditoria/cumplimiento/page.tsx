import { ComplianceService } from "@/lib/services/compliance";
import { EquipmentService } from "@/lib/services/equipment";
import Link from "next/link";

export default async function AuditCompliancePage() {
  const [pendingVerifications, equipments] = await Promise.all([
    ComplianceService.getPendingVerifications(),
    EquipmentService.getEquipments()
  ]);

  // KPIs simples para demostración
  const totalEquipments = equipments.data?.length || 0;
  const equipmentsInMaintenance = equipments.data?.filter(e => e.status === 'maintenance').length || 0;
  const pendingQuality = pendingVerifications.length;

  return (
    <div className="dashboard-container p-6">
      <header className="dashboard-header mb-8">
        <div>
          <h1 className="text-3xl font-black text-navy tracking-tight">Centro de Control Normativo</h1>
          <p className="text-navy-light text-lg">Consolidado de evidencias para Habilitación y ISO 15189</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="card text-center transition-all hover:shadow-xl" style={{ padding: '2rem', borderTop: '8px solid var(--primary)' }}>
          <div className="text-xs font-black uppercase text-navy-light tracking-widest mb-2">Equipos Operativos</div>
          <div className="text-4xl font-black text-navy">{totalEquipments - equipmentsInMaintenance} / {totalEquipments}</div>
        </div>
        <div className="card text-center transition-all hover:shadow-xl" style={{ padding: '2rem', borderTop: '8px solid var(--warning)' }}>
          <div className="text-xs font-black uppercase text-navy-light tracking-widest mb-2">Alertas de Calidad</div>
          <div className="text-4xl font-black text-warning">{pendingQuality} Lotes</div>
        </div>
        <div className="card text-center transition-all hover:shadow-xl" style={{ padding: '2rem', borderTop: '8px solid var(--success)' }}>
          <div className="text-xs font-black uppercase text-navy-light tracking-widest mb-2">Índice de Cumplimiento</div>
          <div className="text-4xl font-black text-success">96%</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="card" style={{ padding: '2rem' }}>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-navy flex items-center gap-2">
              <span className="text-red-500">⚠️</span> Mantenimientos Próximos
            </h2>
          </div>
          <div className="space-y-4">
            {equipments.data?.filter(e => e.next_preventive_maintenance && new Date(e.next_preventive_maintenance) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)).map(eq => (
              <div key={eq.id} className="flex justify-between items-center p-4 bg-red-50 rounded-xl border border-red-100">
                <div>
                  <div className="font-bold text-red-800">{eq.name}</div>
                  <div className="text-sm text-red-600">
                    Vencimiento: {new Date(eq.next_preventive_maintenance!).toLocaleDateString()}
                  </div>
                </div>
                <Link href={`/dashboard/equipos/${eq.id}`} className="btn-secondary btn-sm bg-white border-red-200 text-red-700 hover:bg-red-50">Gestionar</Link>
              </div>
            )) || <p className="text-center text-navy-light py-8 italic">No hay alertas de mantenimiento inmediatas.</p>}
          </div>
        </div>

        <div className="card shadow-glass" style={{ padding: '2rem' }}>
          <h2 className="text-xl font-bold text-navy mb-6">Trazabilidad Técnica (Últimas 24h)</h2>
          <div className="space-y-4">
             <div className="flex items-center gap-4 p-4 bg-app rounded-xl border border-dashed border-navy-light/30">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">✓</div>
                <div>
                  <div className="text-sm font-bold text-navy">Recepción Técnica Completada</div>
                  <div className="text-xs text-navy-light">Factura: FE-5491 | 24.5°C (Estable)</div>
                </div>
             </div>
             <div className="flex items-center gap-4 p-4 bg-app rounded-xl border border-dashed border-navy-light/30 opacity-60">
                <div className="w-10 h-10 rounded-full bg-navy-light/10 flex items-center justify-center text-navy-light font-bold">?</div>
                <div>
                  <div className="text-sm font-bold text-navy italic">Verificación de Lote Pendiente</div>
                  <div className="text-xs text-navy-light">Lote: L8893 | Reactivo: Calcio CPC</div>
                </div>
             </div>
          </div>
          <div className="mt-8 pt-6 border-t border-navy/5 text-right">
            <Link href="/dashboard/auditoria" className="text-primary font-bold hover:underline text-sm uppercase tracking-wide">Registro de Auditoría Completo →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

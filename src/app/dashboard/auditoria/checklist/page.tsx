import Link from "next/link";

export default function ComplianceChecklistPage() {
  const categories = [
    {
      title: "1. Gestión de Selección y Recepción",
      items: [
        { label: "Registro de Proveedores (Datos básicos)", status: true },
        { label: "Criterios de selección y evaluación de desempeño", status: true },
        { label: "Registro de Órdenes de Compra (Módulo Pedidos)", status: true },
        { label: "Recepción Técnica Formal (Inspección + Temperatura)", status: true },
      ]
    },
    {
      title: "2. Gestión de Inventario Item/Lote (ISO 15189)",
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
      items: [
        { label: "Registro de ubicaciones técnicas", status: true },
        { label: "Condiciones requeridas por el fabricante", status: true },
        { label: "Monitoreo diario de Temperatura y Humedad", status: true },
      ]
    },
    {
      title: "4. Trazabilidad y Seguridad",
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
      items: [
        { label: "Reporte de Inventario Vigente", status: true },
        { label: "Reporte de Mermas y Descartes", status: true },
        { label: "Reporte de Incidentes de Calidad (Recall)", status: true },
        { label: "Histórico de Condiciones Ambientales", status: true },
      ]
    },
    {
      title: "6. Mantenimiento y Infraestructura",
      items: [
        { label: "Maestro de Equipos e Instrumentos", status: true },
        { label: "Hoja de Vida Técnica por Equipo", status: true },
        { label: "Control de Mantenimiento y Calibración", status: true },
        { label: "Alertas de Vencimiento de Servicio Técnico", status: true },
      ]
    }
  ];

  return (
    <div className="dashboard-container p-6">
      <header className="dashboard-header mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-navy tracking-tight">Capacidades de Cumplimiento</h1>
          <p className="text-navy-light text-lg">Estado de alineación con ISO 15189 y Resolución 3100</p>
        </div>
        <div className="flex gap-4">
          <Link href="/dashboard/auditoria/cumplimiento" className="btn-secondary btn-sm">Resumen Métrico</Link>
          <button onClick={() => window.print()} className="btn-primary btn-sm">Imprimir Certificación</button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {categories.map((cat, idx) => (
          <div key={idx} className="card shadow-glass hover:shadow-xl transition-all" style={{ padding: '2rem' }}>
            <h2 className="text-xl font-black text-primary mb-6 border-b pb-2 border-primary/10">{cat.title}</h2>
            <div className="space-y-4">
              {cat.items.map((item, iIdx) => (
                <div key={iIdx} className="flex items-center justify-between group">
                  <span className="text-navy text-sm font-semibold">{item.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase text-success tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Verificado</span>
                    <div className="w-6 h-6 rounded-full bg-success/10 flex items-center justify-center text-success border border-success/20">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <footer className="mt-12 p-8 bg-navy/5 rounded-2xl border border-navy/10 text-center">
        <p className="text-navy-light font-bold mb-2">Conclusión Técnica de Cumplimiento</p>
        <p className="text-navy text-sm max-w-3xl mx-auto italic">
          "El software proporciona una infraestructura digital íntegra que garantiza la trazabilidad del reactivo desde su ingreso hasta su disposición final, 
          cumpliendo con los requisitos de integridad de datos, seguridad clínica y control preventivo de fallas exigidos por los entes territoriales de salud."
        </p>
      </footer>

      <style>
        {`
          @media print {
            .btn-secondary, .btn-primary, footer { display: none !important; }
            .card { border: 1px solid #eee !important; box-shadow: none !important; }
          }
        `}
      </style>
    </div>
  );
}

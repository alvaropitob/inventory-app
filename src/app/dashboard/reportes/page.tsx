import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/services/user";
import { ComplianceService } from "@/lib/services/compliance";
import { StockService } from "@/lib/services/stock";
import { CatalogService } from "@/lib/services/catalog";
import {
  CalendarDays,
  ClipboardList,
  DollarSign,
  FileText,
  PackageX,
  ShieldAlert,
  Thermometer,
  Building2,
  BookmarkCheck,
  AlertTriangle,
} from "lucide-react";
import ExportCSVButton from "@/components/ExportCSVButton";
import PrintReportButton from "@/components/PrintReportButton";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ type?: string; section?: string }>;
}

export default async function ReportesPage({ searchParams }: PageProps) {
  const user = await getCurrentUserProfile();
  if (!user) {
    redirect("/auth/login");
  }

  const { type = "resumen" } = await searchParams;

  const [incidents, logs, movementsResponse, batchesResponse, catalogResponse] = await Promise.all([
    ComplianceService.getSafetyIncidents(),
    ComplianceService.getEnvironmentalLogs(200),
    StockService.getAllMovements(),
    StockService.getAllBatches(),
    CatalogService.getCatalogItems(),
  ]);

  interface MovementItem {
    id: string;
    movement_type: string;
    reason?: string | null;
    created_at: string;
    quantity: number;
    equipment_name?: string | null;
    batch?: {
      batch_number: string;
      expiration_date: string;
      item?: { technical_name: string; internal_code: string; purchase_unit?: string | null };
      location?: { name: string };
    };
    user?: { full_name?: string | null; username?: string | null };
  }

  const movements = (movementsResponse.data as MovementItem[]) || [];

  interface BatchItem {
    id: string;
    batch_number: string;
    expiration_date: string;
    current_stock: number;
    initial_quantity?: number;
    status?: string;
    item?: {
      technical_name: string;
      internal_code: string;
      purchase_unit?: string | null;
      minimum_stock_threshold?: number | null;
      sections?: { name: string };
    };
    location?: { name: string };
  }

  const batches = (batchesResponse.data as BatchItem[]) || [];
  const catalog = catalogResponse.data || [];

  // Mermas y Bajas
  const mermas = movements.filter(
    (m) =>
      m.movement_type === "discard" ||
      (m.movement_type === "exit" &&
        (m.reason?.toLowerCase().includes("vencid") ||
          m.reason?.toLowerCase().includes("dañ") ||
          m.reason?.toLowerCase().includes("falla") ||
          m.reason?.toLowerCase().includes("baja") ||
          m.reason?.toLowerCase().includes("descarte") ||
          m.reason?.toLowerCase().includes("merma")))
  );

  // Semáforo de Lotes
  const today = new Date();
  const batchesWithDays = batches.map((b) => {
    const expDate = new Date(b.expiration_date);
    const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    let trafficLight = "Óptimo";
    let trafficColor = "#10b981";

    if (diffDays <= 0 || b.status === "expired") {
      trafficLight = "Vencido";
      trafficColor = "#ef4444";
    } else if (diffDays <= 7) {
      trafficLight = "Crítico (<7 días)";
      trafficColor = "#dc2626";
    } else if (diffDays <= 30) {
      trafficLight = "Alerta (<30 días)";
      trafficColor = "#f59e0b";
    }

    return {
      ...b,
      diffDays,
      trafficLight,
      trafficColor,
    };
  });

  // Datos para exportación Kardex
  const kardexExportData = movements.map((m) => ({
    Fecha: new Date(m.created_at).toLocaleString(),
    Producto: m.batch?.item?.technical_name || "N/A",
    Codigo: m.batch?.item?.internal_code || "N/A",
    Lote: m.batch?.batch_number || "N/A",
    Vencimiento: m.batch?.expiration_date ? new Date(m.batch.expiration_date).toLocaleDateString() : "N/A",
    TipoMovimiento: m.movement_type === "entry" ? "Entrada" : m.movement_type === "exit" ? "Salida" : "Ajuste/Descarte",
    Cantidad: m.quantity,
    Unidad: m.batch?.item?.purchase_unit || "Unidad",
    Ubicacion: m.batch?.location?.name || "N/A",
    Responsable: m.user?.full_name || m.user?.username || "Sistema",
    Motivo_Equipo: m.reason || m.equipment_name || "N/A",
  }));

  // Datos para exportación Vencimientos
  const vencimientosExportData = batchesWithDays.map((b) => ({
    Producto: b.item?.technical_name || "N/A",
    Codigo: b.item?.internal_code || "N/A",
    Lote: b.batch_number,
    FechaVencimiento: new Date(b.expiration_date).toLocaleDateString(),
    DiasRestantes: b.diffDays,
    StockActual: b.current_stock,
    Ubicacion: b.location?.name || "N/A",
    Semaforo: b.trafficLight,
  }));

  // Datos para exportación Suficiencia / Habilitación Res. 3100
  const suficienciaData = catalog.map((item) => {
    const itemBatches = batches.filter((b) => b.item?.internal_code === item.internal_code);
    const totalStock = itemBatches.reduce((acc, b) => acc + (b.current_stock || 0), 0);
    const minStock = item.minimum_stock_threshold || 1;
    let estado = "Suficiente";
    if (totalStock === 0) estado = "Desabastecido (Crítico)";
    else if (totalStock <= minStock) estado = "Stock Mínimo (Alerta)";

    return {
      Codigo: item.internal_code,
      Producto: item.technical_name,
      Seccion: item.sections?.name || "General",
      StockActual: totalStock,
      StockMinimo: minStock,
      Unidad: item.purchase_unit || "Unidad",
      Estado: estado,
    };
  });

  // Datos para exportación Reactivovigilancia
  const reactivoExportData = incidents.map((inc) => ({
    Fecha: new Date(inc.reported_at).toLocaleDateString(),
    TipoIncidente: inc.incident_type,
    Lote: inc.batch?.batch_number || "N/A",
    Descripcion: inc.description || "N/A",
    AccionCorrectiva: inc.action_taken || "Pendiente",
  }));

  // Datos para exportación Mermas
  const mermasExportData = mermas.map((m) => ({
    Fecha: new Date(m.created_at).toLocaleDateString(),
    Producto: m.batch?.item?.technical_name || "N/A",
    Lote: m.batch?.batch_number || "N/A",
    CantidadDescartada: m.quantity,
    Motivo: m.reason || "Baja técnica",
    Responsable: m.user?.full_name || m.user?.username || "Sistema",
  }));

  // Datos para exportación Ambiental
  const ambientalExportData = logs.map((log) => ({
    FechaHora: new Date(log.created_at).toLocaleString(),
    Ubicacion: log.locations?.name || "N/A",
    Temperatura_C: log.temperature,
    Humedad_Porcentaje: log.humidity || "N/A",
    AlertaFueraDeRango: log.is_out_of_range ? "SÍ" : "NO",
  }));

  // Valorización del inventario y costos
  const valorizacionData = catalog.map((item) => {
    const itemBatches = batches.filter((b) => b.item?.internal_code === item.internal_code);
    const totalStock = itemBatches.reduce((acc, b) => acc + (b.current_stock || 0), 0);
    const unitPrice = Number(item.estimated_unit_price || 0);
    const totalValue = totalStock * unitPrice;

    return {
      Codigo: item.internal_code,
      Producto: item.technical_name,
      Seccion: item.sections?.name || "General",
      StockActual: totalStock,
      Unidad: item.purchase_unit || "Unidad",
      PrecioUnitario: unitPrice,
      ValorTotal: totalValue,
    };
  }).filter((item) => item.StockActual > 0 || item.PrecioUnitario > 0);

  const valorTotalInventario = valorizacionData.reduce((acc, curr) => acc + curr.ValorTotal, 0);

  const valorEnRiesgo = batchesWithDays
    .filter((b) => b.diffDays <= 30 && b.current_stock > 0)
    .reduce((acc, b) => {
      const catItem = catalog.find((c) => c.internal_code === b.item?.internal_code);
      const price = Number(catItem?.estimated_unit_price || 0);
      return acc + b.current_stock * price;
    }, 0);

  const valorizacionExportData = valorizacionData.map((item) => ({
    Codigo: item.Codigo,
    Producto: item.Producto,
    Seccion: item.Seccion,
    StockActual: item.StockActual,
    Unidad: item.Unidad,
    CostoUnitario_COP: item.PrecioUnitario,
    ValorTotalStock_COP: item.ValorTotal,
  }));

  const navItems = [
    { key: "resumen", label: "Resumen Normativo", icon: ClipboardList },
    { key: "valorizacion", label: "Valorización y Costos", icon: DollarSign },
    { key: "kardex", label: "Kardex Oficial de Movimientos", icon: FileText },
    { key: "suficiencia", label: "Suficiencia y Habilitación (Res. 3100)", icon: Building2 },
    { key: "vencimientos", label: "Semáforo de Vencimientos", icon: CalendarDays },
    { key: "mermas", label: "Bajas y Disposición Final", icon: PackageX },
    { key: "reactivovigilancia", label: "Reactivovigilancia (INVIMA)", icon: ShieldAlert },
    { key: "ambiental", label: "Bitácora Red de Frío", icon: Thermometer },
  ];

  return (
    <div className="dashboard-main reports-page">
      {/* HEADER DE REPORTE */}
      <div className="page-header">
        <div>
          <h1 className="page-header-title">
            Centro de Reportes y Auditoría
          </h1>
          <p className="page-header-subtitle">
            Informes oficiales para cumplimiento de Resolución 3100 de 2019, ISO 15189 y trazabilidad INVIMA.
          </p>
        </div>
      </div>

      <div className="reports-layout" style={{ display: "grid", gap: "1rem", alignItems: "start" }}>
        {/* NAVEGACIÓN LATERAL DE REPORTES */}
        <div className="reports-nav-card" style={{ backgroundColor: "var(--white)", borderRadius: "var(--radius)", border: "1px solid var(--border)", padding: "1.25rem", boxShadow: "var(--shadow-sm)" }}>
          <h2 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>
            Tipos de Reporte
          </h2>
          <nav style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = type === item.key;
              return (
              <a
                key={item.key}
                href={`?type=${item.key}`}
                className={`report-nav-item${isActive ? " report-nav-item-active" : ""}`}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
                <span>{item.label}</span>
              </a>
              );
            })}
          </nav>
        </div>

        {/* CONTENIDO DEL REPORTE SELECCIONADO */}
        <div className="reports-content-card" style={{ backgroundColor: "var(--white)", borderRadius: "var(--radius)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)", overflow: "hidden" }}>
          
          {/* TAB 1: RESUMEN NORMATIVO */}
          {type === "resumen" && (
            <div style={{ padding: "1.75rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                  <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--navy)" }}>
                    Estado General de Cumplimiento Normativo
                  </h2>
                  <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginTop: "2px" }}>
                    Resumen técnico consolidado para visitas de Habilitación y Certificación de Calidad.
                  </p>
                </div>
                <PrintReportButton reportTitle="Resumen_Normativo" />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "1.75rem" }}>
                <div style={{ padding: "1.25rem", borderRadius: "10px", backgroundColor: "#f8fafc", border: "1px solid var(--border)" }}>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>MOVIMIENTOS TOTALES</p>
                  <p style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--navy)", marginTop: "0.25rem" }}>{movements.length}</p>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>Trazabilidad registrada</p>
                </div>
                <div style={{ padding: "1.25rem", borderRadius: "10px", backgroundColor: "#f8fafc", border: "1px solid var(--border)" }}>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>LOTES EN RIESGO / CRÍTICOS</p>
                  <p style={{ fontSize: "1.75rem", fontWeight: 800, color: batchesWithDays.filter((b) => b.diffDays <= 30).length > 0 ? "var(--error)" : "var(--success)", marginTop: "0.25rem" }}>
                    {batchesWithDays.filter((b) => b.diffDays <= 30).length}
                  </p>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>Vencimiento en ≤ 30 días</p>
                </div>
                <div style={{ padding: "1.25rem", borderRadius: "10px", backgroundColor: "#f8fafc", border: "1px solid var(--border)" }}>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>BAJAS / MERMAS</p>
                  <p style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--warning)", marginTop: "0.25rem" }}>{mermas.length}</p>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>Descartes registrados</p>
                </div>
                <div style={{ padding: "1.25rem", borderRadius: "10px", backgroundColor: "#f8fafc", border: "1px solid var(--border)" }}>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>INCIDENTES INVIMA</p>
                  <p style={{ fontSize: "1.75rem", fontWeight: 800, color: incidents.length > 0 ? "var(--error)" : "var(--success)", marginTop: "0.25rem" }}>{incidents.length}</p>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>Reactivovigilancia</p>
                </div>
              </div>

              <div style={{ padding: "1.25rem", borderRadius: "10px", backgroundColor: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e3a8a", fontSize: "0.875rem", lineHeight: "1.6" }}>
                <h4 style={{ fontWeight: 700, marginBottom: "0.35rem", display: "flex", alignItems: "center", gap: "0.4rem" }}><BookmarkCheck className="ui-icon" aria-hidden="true" /> Guía de Preparación para Visitas de Auditoría:</h4>
                <ul style={{ paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  <li>Para <b>Habilitación (Resolución 3100)</b>: descargue el reporte de <i>Suficiencia de Insumos</i> y la <i>Bitácora de Red de Frío</i> del último mes.</li>
                  <li>Para <b>Inspección INVIMA</b>: presente el reporte oficial de <i>Reactivovigilancia</i> junto con las actas de <i>Bajas y Disposición Final</i>.</li>
                  <li>Para <b>ISO 15189</b>: descargue el <i>Kardex Oficial</i> para validar la trazabilidad por lote y la no utilización de reactivos caducados.</li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 2: KARDEX OFICIAL DE MOVIMIENTOS */}
          {type === "kardex" && (
            <div>
              <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                  <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--navy)" }}>Kardex Oficial de Movimientos</h2>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Historial cronológico inmutable de entradas, salidas y descartes.</p>
                </div>
                <div style={{ display: "flex", gap: "0.75rem" }}>
                  <ExportCSVButton data={kardexExportData} filename="KARDEX_MOVIMIENTOS" label="Exportar a Excel / CSV" />
                  <PrintReportButton reportTitle="Kardex_Oficial_Movimientos" />
                </div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.85rem" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid var(--border)", color: "var(--text-muted)", textTransform: "uppercase", fontSize: "0.725rem" }}>
                      <th style={{ padding: "0.75rem 1rem" }}>Fecha / Hora</th>
                      <th style={{ padding: "0.75rem 1rem" }}>Producto</th>
                      <th style={{ padding: "0.75rem 1rem" }}>Lote</th>
                      <th style={{ padding: "0.75rem 1rem" }}>Tipo</th>
                      <th style={{ padding: "0.75rem 1rem", textAlign: "center" }}>Cantidad</th>
                      <th style={{ padding: "0.75rem 1rem" }}>Ubicación</th>
                      <th style={{ padding: "0.75rem 1rem" }}>Responsable</th>
                      <th style={{ padding: "0.75rem 1rem" }}>Motivo / Destino</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((m) => (
                      <tr key={m.id} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "0.75rem 1rem", whiteSpace: "nowrap" }}>{new Date(m.created_at).toLocaleString()}</td>
                        <td style={{ padding: "0.75rem 1rem", fontWeight: 600, color: "var(--navy)" }}>{m.batch?.item?.technical_name || "N/A"}</td>
                        <td style={{ padding: "0.75rem 1rem", fontFamily: "monospace" }}>{m.batch?.batch_number || "—"}</td>
                        <td style={{ padding: "0.75rem 1rem" }}>
                          <span
                            style={{
                              padding: "0.2rem 0.5rem",
                              borderRadius: "4px",
                              fontSize: "0.725rem",
                              fontWeight: 700,
                              backgroundColor: m.movement_type === "entry" ? "#dcfce7" : m.movement_type === "exit" ? "#fee2e2" : "#fef3c7",
                              color: m.movement_type === "entry" ? "#15803d" : m.movement_type === "exit" ? "#991b1b" : "#b45309",
                            }}
                          >
                            {m.movement_type === "entry" ? "Entrada" : m.movement_type === "exit" ? "Salida" : "Ajuste/Baja"}
                          </span>
                        </td>
                        <td style={{ padding: "0.75rem 1rem", textAlign: "center", fontWeight: 700 }}>
                          {m.movement_type === "exit" ? `-${m.quantity}` : `+${m.quantity}`}
                        </td>
                        <td style={{ padding: "0.75rem 1rem" }}>{m.batch?.location?.name || "—"}</td>
                        <td style={{ padding: "0.75rem 1rem" }}>{m.user?.full_name || m.user?.username || "Sistema"}</td>
                        <td style={{ padding: "0.75rem 1rem", color: "var(--text-muted)" }}>{m.reason || m.equipment_name || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: SUFICIENCIA Y HABILITACIÓN RES 3100 */}
          {type === "suficiencia" && (
            <div>
              <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                  <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--navy)" }}>Suficiencia de Insumos y Reactivos (Res. 3100)</h2>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Evidencia de disponibilidad de stock para la cartera de servicios habilitada.</p>
                </div>
                <div style={{ display: "flex", gap: "0.75rem" }}>
                  <ExportCSVButton data={suficienciaData} filename="SUFICIENCIA_HABILITACION_RES3100" label="Exportar a Excel / CSV" />
                  <PrintReportButton reportTitle="Suficiencia_Insumos_Res3100" />
                </div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.85rem" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid var(--border)", color: "var(--text-muted)", textTransform: "uppercase", fontSize: "0.725rem" }}>
                      <th style={{ padding: "0.75rem 1rem" }}>Código</th>
                      <th style={{ padding: "0.75rem 1rem" }}>Reactivo / Dispositivo</th>
                      <th style={{ padding: "0.75rem 1rem" }}>Sección</th>
                      <th style={{ padding: "0.75rem 1rem", textAlign: "center" }}>Stock Actual</th>
                      <th style={{ padding: "0.75rem 1rem", textAlign: "center" }}>Mínimo Requerido</th>
                      <th style={{ padding: "0.75rem 1rem", textAlign: "center" }}>Estado de Suficiencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suficienciaData.map((item) => (
                      <tr key={item.Codigo} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "0.75rem 1rem", fontFamily: "monospace", color: "var(--text-muted)" }}>{item.Codigo}</td>
                        <td style={{ padding: "0.75rem 1rem", fontWeight: 600, color: "var(--navy)" }}>{item.Producto}</td>
                        <td style={{ padding: "0.75rem 1rem" }}>{item.Seccion}</td>
                        <td style={{ padding: "0.75rem 1rem", textAlign: "center", fontWeight: 700 }}>
                          {item.StockActual} {item.Unidad}
                        </td>
                        <td style={{ padding: "0.75rem 1rem", textAlign: "center", color: "var(--text-muted)" }}>{item.StockMinimo}</td>
                        <td style={{ padding: "0.75rem 1rem", textAlign: "center" }}>
                          <span
                            style={{
                              padding: "0.25rem 0.65rem",
                              borderRadius: "999px",
                              fontSize: "0.725rem",
                              fontWeight: 700,
                              backgroundColor: item.StockActual === 0 ? "#fee2e2" : item.StockActual <= item.StockMinimo ? "#fef3c7" : "#dcfce7",
                              color: item.StockActual === 0 ? "#991b1b" : item.StockActual <= item.StockMinimo ? "#b45309" : "#15803d",
                            }}
                          >
                            {item.Estado}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: SEMÁFORO DE VENCIMIENTOS */}
          {type === "vencimientos" && (
            <div>
              <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                  <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--navy)" }}>Semáforo de Vencimientos de Lotes</h2>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Control estricto de fechas de expiración para evitar uso de material no apto.</p>
                </div>
                <div style={{ display: "flex", gap: "0.75rem" }}>
                  <ExportCSVButton data={vencimientosExportData} filename="SEMAFORO_VENCIMIENTOS" label="Exportar a Excel / CSV" />
                  <PrintReportButton reportTitle="Semaforo_Vencimientos" />
                </div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.85rem" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid var(--border)", color: "var(--text-muted)", textTransform: "uppercase", fontSize: "0.725rem" }}>
                      <th style={{ padding: "0.75rem 1rem" }}>Producto</th>
                      <th style={{ padding: "0.75rem 1rem" }}>Lote</th>
                      <th style={{ padding: "0.75rem 1rem" }}>Fecha Vencimiento</th>
                      <th style={{ padding: "0.75rem 1rem", textAlign: "center" }}>Días Restantes</th>
                      <th style={{ padding: "0.75rem 1rem", textAlign: "center" }}>Stock Disponible</th>
                      <th style={{ padding: "0.75rem 1rem" }}>Ubicación</th>
                      <th style={{ padding: "0.75rem 1rem", textAlign: "center" }}>Semáforo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batchesWithDays.map((b) => (
                      <tr key={b.id} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "0.75rem 1rem", fontWeight: 600, color: "var(--navy)" }}>{b.item?.technical_name || "N/A"}</td>
                        <td style={{ padding: "0.75rem 1rem", fontFamily: "monospace" }}>{b.batch_number}</td>
                        <td style={{ padding: "0.75rem 1rem" }}>{new Date(b.expiration_date).toLocaleDateString()}</td>
                        <td style={{ padding: "0.75rem 1rem", textAlign: "center", fontWeight: 700, color: b.trafficColor }}>
                          {b.diffDays <= 0 ? "VENCIDO" : `${b.diffDays} días`}
                        </td>
                        <td style={{ padding: "0.75rem 1rem", textAlign: "center", fontWeight: 600 }}>{b.current_stock}</td>
                        <td style={{ padding: "0.75rem 1rem" }}>{b.location?.name || "—"}</td>
                        <td style={{ padding: "0.75rem 1rem", textAlign: "center" }}>
                          <span
                            style={{
                              padding: "0.25rem 0.65rem",
                              borderRadius: "999px",
                              fontSize: "0.725rem",
                              fontWeight: 700,
                              backgroundColor: `${b.trafficColor}20`,
                              color: b.trafficColor,
                              border: `1px solid ${b.trafficColor}60`,
                            }}
                          >
                            {b.trafficLight}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: BAJAS Y DISPOSICIÓN FINAL */}
          {type === "mermas" && (
            <div>
              <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                  <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--navy)" }}>Registro de Bajas y Disposición Final</h2>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Control de residuos, pérdidas, reactivos vencidos y bajas técnicas justificadas.</p>
                </div>
                <div style={{ display: "flex", gap: "0.75rem" }}>
                  <ExportCSVButton data={mermasExportData} filename="BAJAS_DISPOSICION_FINAL" label="Exportar a Excel / CSV" />
                  <PrintReportButton reportTitle="Bajas_Disposicion_Final" />
                </div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.85rem" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid var(--border)", color: "var(--text-muted)", textTransform: "uppercase", fontSize: "0.725rem" }}>
                      <th style={{ padding: "0.75rem 1rem" }}>Fecha de Baja</th>
                      <th style={{ padding: "0.75rem 1rem" }}>Producto</th>
                      <th style={{ padding: "0.75rem 1rem" }}>Lote</th>
                      <th style={{ padding: "0.75rem 1rem", textAlign: "center" }}>Cantidad Dada de Baja</th>
                      <th style={{ padding: "0.75rem 1rem" }}>Motivo / Justificación</th>
                      <th style={{ padding: "0.75rem 1rem" }}>Responsable</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mermas.map((m) => (
                      <tr key={m.id} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "0.75rem 1rem" }}>{new Date(m.created_at).toLocaleDateString()}</td>
                        <td style={{ padding: "0.75rem 1rem", fontWeight: 600, color: "var(--navy)" }}>{m.batch?.item?.technical_name || "N/A"}</td>
                        <td style={{ padding: "0.75rem 1rem", fontFamily: "monospace" }}>{m.batch?.batch_number || "—"}</td>
                        <td style={{ padding: "0.75rem 1rem", textAlign: "center", color: "#991b1b", fontWeight: 700 }}>
                          -{m.quantity}
                        </td>
                        <td style={{ padding: "0.75rem 1rem", color: "var(--navy)" }}>{m.reason}</td>
                        <td style={{ padding: "0.75rem 1rem" }}>{m.user?.full_name || m.user?.username || "Sistema"}</td>
                      </tr>
                    ))}
                    {mermas.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>
                          No se registran descartes o mermas en el período.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: REACTIVOVIGILANCIA */}
          {type === "reactivovigilancia" && (
            <div>
              <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                  <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--navy)" }}>Bitácora de Reactivovigilancia (INVIMA)</h2>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Reportes de defectos de calidad, eventos adversos e incidentes con reactivos de diagnóstico.</p>
                </div>
                <div style={{ display: "flex", gap: "0.75rem" }}>
                  <ExportCSVButton data={reactivoExportData} filename="REACTIVOVIGILANCIA_INVIMA" label="Exportar a Excel / CSV" />
                  <PrintReportButton reportTitle="Reactivovigilancia_INVIMA" />
                </div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.85rem" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid var(--border)", color: "var(--text-muted)", textTransform: "uppercase", fontSize: "0.725rem" }}>
                      <th style={{ padding: "0.75rem 1rem" }}>Fecha Notificación</th>
                      <th style={{ padding: "0.75rem 1rem" }}>Tipo de Incidente</th>
                      <th style={{ padding: "0.75rem 1rem" }}>Lote Afectado</th>
                      <th style={{ padding: "0.75rem 1rem" }}>Descripción del Defecto</th>
                      <th style={{ padding: "0.75rem 1rem" }}>Acción Correctiva</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incidents.map((inc) => (
                      <tr key={inc.id} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "0.75rem 1rem" }}>{new Date(inc.reported_at).toLocaleDateString()}</td>
                        <td style={{ padding: "0.75rem 1rem", fontWeight: 600, color: "var(--primary-dark)" }}>{inc.incident_type}</td>
                        <td style={{ padding: "0.75rem 1rem", fontFamily: "monospace" }}>{inc.batch?.batch_number || "—"}</td>
                        <td style={{ padding: "0.75rem 1rem", color: "var(--navy)" }}>{inc.description}</td>
                        <td style={{ padding: "0.75rem 1rem" }}>{inc.action_taken || "En investigación"}</td>
                      </tr>
                    ))}
                    {incidents.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>
                          No hay incidentes reportados en la bitácora de reactivovigilancia.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 7: HISTORIAL AMBIENTAL */}
          {type === "ambiental" && (
            <div>
              <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                  <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--navy)" }}>Bitácora de Monitoreo Térmico (Red de Frío)</h2>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Lecturas AM/PM de temperatura y humedad en neveras, cuartos fríos y estantes.</p>
                </div>
                <div style={{ display: "flex", gap: "0.75rem" }}>
                  <ExportCSVButton data={ambientalExportData} filename="RED_FRIO_TEMPERATURAS" label="Exportar a Excel / CSV" />
                  <PrintReportButton reportTitle="Bitacora_Termica_Red_Frio" />
                </div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.85rem" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid var(--border)", color: "var(--text-muted)", textTransform: "uppercase", fontSize: "0.725rem" }}>
                      <th style={{ padding: "0.75rem 1rem" }}>Fecha y Hora</th>
                      <th style={{ padding: "0.75rem 1rem" }}>Ubicación / Equipo de Frío</th>
                      <th style={{ padding: "0.75rem 1rem", textAlign: "center" }}>Temperatura (°C)</th>
                      <th style={{ padding: "0.75rem 1rem", textAlign: "center" }}>Humedad (%)</th>
                      <th style={{ padding: "0.75rem 1rem", textAlign: "center" }}>Estado de Rango</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "0.75rem 1rem" }}>{new Date(log.created_at).toLocaleString()}</td>
                        <td style={{ padding: "0.75rem 1rem", fontWeight: 600, color: "var(--navy)" }}>{log.locations?.name || "N/A"}</td>
                        <td style={{ padding: "0.75rem 1rem", textAlign: "center", fontWeight: 700, color: log.is_out_of_range ? "#dc2626" : "var(--navy)" }}>
                          {log.temperature} °C
                        </td>
                        <td style={{ padding: "0.75rem 1rem", textAlign: "center" }}>{log.humidity ? `${log.humidity}%` : "—"}</td>
                        <td style={{ padding: "0.75rem 1rem", textAlign: "center" }}>
                          <span
                            style={{
                              padding: "0.2rem 0.5rem",
                              borderRadius: "4px",
                              fontSize: "0.725rem",
                              fontWeight: 700,
                              backgroundColor: log.is_out_of_range ? "#fee2e2" : "#dcfce7",
                              color: log.is_out_of_range ? "#991b1b" : "#15803d",
                            }}
                          >
                            {log.is_out_of_range ? <><AlertTriangle className="ui-icon" aria-hidden="true" /> FUERA DE RANGO</> : "En Rango"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 8: VALORIZACIÓN Y COSTOS DEL INVENTARIO */}
          {type === "valorizacion" && (
            <div>
              <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                  <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--navy)" }}>Valorización Económica del Inventario</h2>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Control financiero de reactivos en stock, costos operativos y capital en riesgo.</p>
                </div>
                <div style={{ display: "flex", gap: "0.75rem" }}>
                  <ExportCSVButton data={valorizacionExportData} filename="VALORIZACION_INVENTARIO_COSTOS" label="Exportar a Excel / CSV" />
                  <PrintReportButton reportTitle="Valorizacion_Inventario_Costos" />
                </div>
              </div>

              {/* KPIS FINANCIEROS */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", padding: "1.25rem 1.5rem 0.5rem" }}>
                <div style={{ padding: "1.25rem", borderRadius: "10px", backgroundColor: "#f8fafc", border: "1px solid var(--border)" }}>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>VALOR TOTAL EN STOCK</p>
                  <p style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--navy)", marginTop: "0.25rem" }}>
                    ${valorTotalInventario.toLocaleString("es-CO")}
                  </p>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>Capital activo en reactivos</p>
                </div>
                <div style={{ padding: "1.25rem", borderRadius: "10px", backgroundColor: "#f8fafc", border: "1px solid var(--border)" }}>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>CAPITAL EN RIESGO (≤30 DÍAS)</p>
                  <p style={{ fontSize: "1.75rem", fontWeight: 800, color: valorEnRiesgo > 0 ? "var(--warning)" : "var(--success)", marginTop: "0.25rem" }}>
                    ${valorEnRiesgo.toLocaleString("es-CO")}
                  </p>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>Reactivos por vencer pronto</p>
                </div>
                <div style={{ padding: "1.25rem", borderRadius: "10px", backgroundColor: "#f8fafc", border: "1px solid var(--border)" }}>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>ÍTEMS VALORIZADOS</p>
                  <p style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--primary-dark)", marginTop: "0.25rem" }}>
                    {valorizacionData.length}
                  </p>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>Con precio o stock activo</p>
                </div>
              </div>

              <div style={{ overflowX: "auto", padding: "1rem 0" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.85rem" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid var(--border)", color: "var(--text-muted)", textTransform: "uppercase", fontSize: "0.725rem" }}>
                      <th style={{ padding: "0.75rem 1rem" }}>Código</th>
                      <th style={{ padding: "0.75rem 1rem" }}>Producto / Reactivo</th>
                      <th style={{ padding: "0.75rem 1rem" }}>Sección</th>
                      <th style={{ padding: "0.75rem 1rem", textAlign: "center" }}>Stock Actual</th>
                      <th style={{ padding: "0.75rem 1rem", textAlign: "right" }}>Costo Unitario</th>
                      <th style={{ padding: "0.75rem 1rem", textAlign: "right" }}>Valor Total Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {valorizacionData.map((item) => (
                      <tr key={item.Codigo} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "0.75rem 1rem", fontFamily: "monospace", color: "var(--text-muted)" }}>{item.Codigo}</td>
                        <td style={{ padding: "0.75rem 1rem", fontWeight: 600, color: "var(--navy)" }}>{item.Producto}</td>
                        <td style={{ padding: "0.75rem 1rem" }}>{item.Seccion}</td>
                        <td style={{ padding: "0.75rem 1rem", textAlign: "center", fontWeight: 600 }}>
                          {item.StockActual} {item.Unidad}
                        </td>
                        <td style={{ padding: "0.75rem 1rem", textAlign: "right", color: "var(--text-muted)" }}>
                          {item.PrecioUnitario > 0 ? `$${item.PrecioUnitario.toLocaleString("es-CO")}` : "Sin precio"}
                        </td>
                        <td style={{ padding: "0.75rem 1rem", textAlign: "right", fontWeight: 700, color: "var(--navy)" }}>
                          ${item.ValorTotal.toLocaleString("es-CO")}
                        </td>
                      </tr>
                    ))}
                    {valorizacionData.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>
                          No hay productos con stock o precios registrados en el catálogo.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

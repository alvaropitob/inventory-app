"use client";

import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import Sidebar from "./Sidebar";
import ContextualHelp from "./ContextualHelp";

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
  const searchParams = useSearchParams();
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

  const view = searchParams.get("view");
  const pageHelp = pathname.startsWith("/dashboard/inventario/calidad")
    ? { title: "Verificación de calidad", description: "Evalúa los lotes en cuarentena antes de liberarlos para uso clínico.", steps: ["Revisa el lote y la evidencia técnica disponible.", "Registra el resultado de la verificación.", "Libera o mantiene el lote en cuarentena según el resultado."], tips: ["No liberes un lote si persiste una duda sobre su identidad, conservación o documentación."] }
    : pathname === "/dashboard/inventario"
    ? view === "traslados"
      ? { title: "Traslados internos", description: "Mueve existencias entre ubicaciones manteniendo la trazabilidad del lote.", steps: ["Selecciona el lote origen y confirma la ubicación actual.", "Elige la ubicación de destino y registra una cantidad disponible.", "Añade el motivo y confirma el traslado."], tips: ["Verifica que origen y destino sean distintos y que la cantidad no supere el stock disponible."] }
      : view === "stock"
        ? { title: "Stock actual", description: "Consulta las existencias vigentes agrupadas por producto y lote.", steps: ["Busca el insumo que necesitas revisar.", "Compara cantidades y ubicaciones por lote.", "Abre los movimientos si necesitas investigar el historial."], tips: ["La disponibilidad se calcula con los movimientos registrados para cada lote."] }
        : view === "salidas"
        ? { title: "Salidas de inventario", description: "Registra consumos y entregas para descontar existencias por lote.", steps: ["Identifica el insumo y lote requerido.", "Indica cantidad, destino o responsable y motivo.", "Confirma la salida y revisa el movimiento generado."], tips: ["Prioriza el lote con vencimiento más próximo (FEFO)."] }
        : view === "trazabilidad" || view === "movimientos"
          ? { title: "Trazabilidad de inventario", description: "Consulta el historial de entradas, salidas, ajustes y traslados con sus responsables.", steps: ["Filtra o revisa los movimientos por fecha e insumo.", "Comprueba lote, cantidad, tipo de movimiento y usuario.", "Usa el detalle para aclarar diferencias de existencias."], tips: ["Los movimientos registrados permiten reconstruir el recorrido del inventario."] }
        : view === "bajas"
            ? { title: "Bajas y disposición final", description: "Registra productos vencidos, dañados o no aptos y documenta su disposición.", steps: ["Selecciona el lote y la cantidad que se dará de baja.", "Elige el método de disposición correspondiente.", "Describe el motivo y confirma el registro."], tips: ["Confirma el lote y la cantidad antes de guardar; la baja afecta las existencias disponibles."] }
            : { title: "Gestión de inventario", description: "Administra el catálogo, las entradas y los lotes disponibles del laboratorio.", steps: ["Busca el producto o crea su ficha si aún no existe.", "Registra proveedor, lote, vencimiento, cantidad y ubicación.", "Revisa alertas de vencimiento y existencias antes de operar."], tips: ["Mantén separados los lotes del mismo producto para conservar vencimientos y costos correctos."] }
    : pathname.startsWith("/dashboard/pedidos/nuevo")
      ? { title: "Crear orden de compra", description: "Prepara una requisición para abastecer productos del laboratorio.", steps: ["Selecciona el proveedor y la fecha esperada.", "Agrega productos y cantidades solicitadas.", "Revisa el valor estimado y guarda la orden."], tips: ["Comprueba cantidades y proveedor antes de enviar la solicitud."] }
      : pathname.startsWith("/dashboard/pedidos/")
        ? { title: "Detalle de la orden", description: "Consulta el estado de la orden y gestiona su solicitud o recepción.", steps: ["Revisa proveedor, productos y cantidades.", "Solicita la orden cuando el borrador esté completo.", "Al recibir, registra cantidades reales, lotes y vencimientos."], tips: ["Una recepción parcial puede completarse en un registro posterior."] }
        : pathname === "/dashboard/pedidos"
          ? { title: "Órdenes de compra", description: "Da seguimiento a requisiciones y abastecimiento de proveedores.", steps: ["Revisa el estado y la fecha esperada.", "Abre una orden para consultar sus líneas.", "Crea una nueva orden cuando necesites reabastecer."], tips: ["Las órdenes pendientes de recepción también aparecen en Recepción Técnica."] }
          : pathname.startsWith("/dashboard/recepcion/")
            ? { title: "Inspección técnica de recepción", description: "Documenta la conformidad de lo recibido antes de incorporarlo al inventario.", steps: ["Compara los productos y cantidades con la orden.", "Registra lote, vencimiento, estado del empaque y temperatura cuando aplique.", "Aprueba, deja en cuarentena o rechaza según la inspección."], tips: ["No liberes un lote si la documentación o las condiciones de transporte no son conformes."] }
            : pathname === "/dashboard/recepcion"
              ? { title: "Recepción técnica y trazabilidad", description: "Inicia la inspección de las órdenes recibidas y registra la evidencia del ingreso.", steps: ["Selecciona una orden pendiente o parcialmente recibida.", "Verifica empaque, temperatura, cantidades y documentos.", "Registra lotes y vencimientos para conservar la trazabilidad."], tips: ["Las recepciones parciales quedan pendientes hasta completar las cantidades solicitadas."] }
              : pathname.startsWith("/dashboard/proveedores/evaluacion")
                ? { title: "Evaluación de proveedores", description: "Califica el desempeño de cada proveedor para apoyar decisiones de compra.", steps: ["Selecciona al proveedor evaluado.", "Asigna puntajes según calidad, entrega y soporte.", "Escribe observaciones que expliquen la evaluación y guarda."], tips: ["Usa criterios consistentes y sustenta puntajes bajos con evidencia."] }
                : pathname === "/dashboard/proveedores"
                  ? { title: "Gestión de proveedores", description: "Mantén actualizados los datos de contacto y estado de los proveedores.", steps: ["Busca el proveedor o registra uno nuevo.", "Verifica identificación y datos de contacto.", "Consulta sus evaluaciones antes de nuevas compras."], tips: ["Desactiva proveedores que ya no deben seleccionarse en nuevas órdenes."] }
                  : pathname.startsWith("/dashboard/monitoreo")
                    ? { title: "Monitoreo ambiental", description: "Registra condiciones ambientales por ubicación y detecta lecturas fuera de rango.", steps: ["Selecciona la ubicación monitoreada.", "Ingresa temperatura, humedad y fecha de lectura.", "Añade observaciones y registra cualquier desviación."], tips: ["Ante una lectura fuera de rango, documenta la acción correctiva y notifica al responsable."] }
                    : pathname.startsWith("/dashboard/equipos/")
                      ? { title: "Hoja de vida del equipo", description: "Consulta la identificación técnica y el historial de mantenimiento del equipo.", steps: ["Verifica modelo, serial y ubicación.", "Registra mantenimientos o calibraciones con su fecha y responsable.", "Actualiza la próxima intervención cuando corresponda."], tips: ["Conserva los soportes técnicos asociados a cada intervención."] }
                      : pathname === "/dashboard/equipos"
                        ? { title: "Gestión de equipos", description: "Administra equipos, ubicación, estado y calendario de mantenimiento.", steps: ["Registra o selecciona un equipo.", "Mantén al día serial, ubicación y estado operativo.", "Programa mantenimiento preventivo o correctivo."], tips: ["Atiende primero los equipos con mantenimiento vencido o próximo."] }
                        : pathname.startsWith("/dashboard/auditoria/checklist")
                          ? { title: "Checklist de cumplimiento", description: "Revisa los controles y evidencias asociados a los requisitos del laboratorio.", steps: ["Abre cada requisito y valida la evidencia disponible.", "Registra el resultado y las observaciones.", "Da seguimiento a los puntos pendientes."], tips: ["Documenta evidencias verificables y responsables de las acciones pendientes."] }
                          : pathname.startsWith("/dashboard/auditoria/cumplimiento")
                            ? { title: "Cumplimiento normativo", description: "Revisa indicadores de equipos, calidad y tareas de mantenimiento pendientes.", steps: ["Consulta los indicadores de cumplimiento.", "Identifica alertas de calidad o mantenimiento.", "Abre el registro relacionado para gestionar la acción."], tips: ["Prioriza alertas urgentes y conserva evidencia de su cierre."] }
                            : pathname === "/dashboard/auditoria"
                              ? { title: "Auditoría y trazabilidad", description: "Consulta el registro de actividad para reconstruir quién realizó cada operación y cuándo.", steps: ["Revisa fecha, usuario, acción y entidad afectada.", "Inspecciona el detalle técnico del registro.", "Usa la información para investigar cambios o incidentes."], tips: ["El registro es de consulta; documenta correcciones mediante los flujos operativos correspondientes."] }
                              : pathname.startsWith("/dashboard/seguridad/reportar")
                                ? { title: "Reporte de incidente", description: "Registra una desviación o incidente relacionado con la seguridad de un producto clínico.", steps: ["Selecciona el tipo de incidente.", "Describe cuándo y cómo ocurrió y el lote involucrado.", "Registra las acciones inmediatas y envía el reporte."], tips: ["Describe hechos observables y conserva el lote identificado para facilitar la investigación."] }
                                : pathname === "/dashboard/seguridad"
                                  ? { title: "Seguridad clínica", description: "Supervisa incidentes y reportes de reactivos o insumos clínicos.", steps: ["Revisa los incidentes registrados.", "Abre el detalle para consultar producto, lote y acciones.", "Reporta de inmediato cualquier nuevo evento."], tips: ["Incluye información suficiente para identificar el producto y contener el riesgo."] }
                                  : pathname.startsWith("/dashboard/reportes")
                                    ? { title: "Reportes", description: "Consulta y exporta información operativa para analizar inventario, compras y cumplimiento.", steps: ["Selecciona el tipo de reporte.", "Revisa el periodo y los filtros disponibles.", "Exporta o imprime los resultados cuando estén completos."], tips: ["Confirma los filtros antes de compartir un reporte."] }
                                    : pathname.startsWith("/dashboard/usuarios")
                                      ? { title: "Gestión de usuarios", description: "Administra cuentas y roles de acceso del personal clínico.", steps: ["Busca o registra al usuario.", "Asigna el rol de acuerdo con sus responsabilidades.", "Revisa que el acceso sea el necesario para su trabajo."], tips: ["Los roles determinan las operaciones y datos que cada persona puede consultar."] }
                                      : pathname.startsWith("/dashboard/configuracion")
                                        ? { title: "Configuración de maestros", description: "Mantén los catálogos base usados por inventario, compras y operación.", steps: ["Selecciona el tipo de catálogo.", "Agrega o edita el registro requerido.", "Verifica que el nombre y estado sean correctos antes de guardar."], tips: ["Cambiar un maestro puede afectar su disponibilidad en formularios relacionados."] }
                                        : { title: "Panel operativo", description: "Consulta un resumen de existencias, pedidos y alertas que requieren atención.", steps: ["Revisa las alertas prioritarias.", "Abre el módulo relacionado para gestionar cada pendiente.", "Vuelve al panel para confirmar el estado actualizado."], tips: ["Atiende primero vencimientos críticos y tareas de calidad pendientes."] };

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
              <ContextualHelp content={pageHelp} />
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

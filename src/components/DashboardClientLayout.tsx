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
  appVersion: string;
  deploymentEnvironment: string;
}

export default function DashboardClientLayout({ children, user, appVersion, deploymentEnvironment }: DashboardClientLayoutProps) {
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
  const inventoryViewTitles: Record<string, string> = {
    entradas: "Entradas y catálogo",
    stock: "Stock",
    salidas: "Salidas",
    bajas: "Bajas y disposición final",
    traslados: "Traslados",
    movimientos: "Trazabilidad",
    trazabilidad: "Trazabilidad",
  };
  const reportTitles: Record<string, string> = {
    resumen: "Resumen normativo",
    kardex: "Kardex",
    suficiencia: "Suficiencia",
    vencimientos: "Vencimientos",
    mermas: "Mermas",
    reactivovigilancia: "Reactivovigilancia",
    ambiental: "Monitoreo ambiental",
    valorizacion: "Valorización",
  };
  const contextualPageTitle = pathname === "/dashboard/inventario"
    ? (view === "bajas" ? inventoryViewTitles.entradas : inventoryViewTitles[view || "entradas"]) || "Inventario y lotes"
    : pathname === "/dashboard/reportes"
      ? reportTitles[searchParams.get("type") || "suficiencia"] || "Suficiencia"
      : pathname.startsWith("/dashboard/pedidos/") && pathname !== "/dashboard/pedidos/nuevo"
        ? "Detalle del pedido"
        : pathname.startsWith("/dashboard/recepcion/")
          ? "Inspección técnica"
          : pageTitle;
  const pageHelp = pathname.startsWith("/dashboard/inventario/calidad")
    ? { title: "Verificación de calidad", description: "Registra el resultado y la evidencia de una prueba aplicada a un lote en cuarentena.", steps: ["Confirma que el producto, lote y control usado correspondan a la prueba.", "Selecciona aprobado o fallido y registra observaciones.", "Guarda el resultado asociado al usuario autenticado."], tips: ["En la versión actual, guardar la verificación registra el resultado, pero no cambia el estado del lote ni lo libera para salida.", "El PIN de esta pantalla solo habilita el botón; no se valida contra la contraseña de la cuenta ni constituye una firma electrónica certificada."] }
    : pathname === "/dashboard/inventario"
    ? view === "traslados"
      ? { title: "Traslados internos", description: "Mueve empaques de un lote entre ubicaciones y conserva el registro del movimiento.", steps: ["Elige un lote disponible y revisa su ubicación de origen.", "Selecciona una ubicación de destino permitida para el área.", "Indica una cantidad de empaques y un motivo antes de confirmar."], tips: ["El traslado conserva la cantidad total; no es una salida por consumo.", "La cantidad no puede superar los empaques disponibles y las ubicaciones deben ser distintas."] }
      : view === "stock"
        ? { title: "Stock actual", description: "Consulta empaques y unidades abiertas por producto, lote y ubicación.", steps: ["Busca el producto por nombre o código.", "Revisa estado clínico, vencimiento, ubicación y cantidades disponibles.", "Abre Trazabilidad para revisar entradas, salidas, bajas o traslados."], tips: ["Un lote en cuarentena, rechazado o vencido puede aparecer en inventario, pero no está disponible para salida clínica."] }
        : view === "salidas"
        ? { title: "Salidas de inventario", description: "Registra el consumo del lote en empaques completos o unidades internas.", steps: ["Filtra por área y selecciona producto y lote disponible.", "Elige empaques completos o unidades internas según lo que retiras; el área solo filtra lotes.", "Indica motivo y destino/equipo si aplica. Confirma y revisa el movimiento en Trazabilidad."], tips: ["Se sugiere el lote con vencimiento más próximo (FEFO). Si eliges otro, debes justificarlo.", "En el flujo habitual de Especiales se suele retirar por unidad y en Química por caja. Confirma el modo y presentación; esta sugerencia no está impuesta automáticamente por el sistema."] }
        : view === "bajas"
        ? { title: "Bajas y disposición final", description: "Retira productos que no deben usarse y registra causa, ruta de disposición y justificación.", steps: ["Selecciona el lote y revisa su estado y existencias.", "Indica empaques completos y/o unidades abiertas sin exceder lo disponible.", "Selecciona causa y método, escribe la justificación y confirma. Revisa el registro en Mermas y Trazabilidad."], tips: ["La baja no se puede deshacer desde el formulario y requiere rol administrador o supervisor.", "Si ocurre un error, revisa el resultado antes de volver a enviar para evitar repetir una acción ya procesada."] }
        : view === "trazabilidad" || view === "movimientos"
          ? { title: "Trazabilidad de inventario", description: "Consulta movimientos y filtra por fechas, usuario, producto, ubicación o tipo.", steps: ["Aplica filtros y revisa fecha, lote, cantidad, responsable y detalle.", "En las bajas revisa causa y método cuando estén disponibles.", "Exporta el resultado si necesitas compartirlo o analizarlo."], tips: ["Movimientos históricos anteriores a la captura estructurada pueden mostrar causa o método como “Sin especificar”."] }
        : { title: "Entrada manual y catálogo", description: "Usa este formulario para crear una ficha o registrar existencias que no llegan mediante una orden de compra.", steps: ["Busca el producto existente o completa sus datos de catálogo.", "Indica cantidad, lote, vencimiento y ubicación.", "Para compras a proveedor, crea un pedido y registra lo recibido en Recepción Técnica."], tips: ["Verifica la unidad de compra del producto antes de ingresar cantidades.", "La recepción técnica conserva el vínculo con orden, proveedor y factura; no la reemplaces por una entrada manual."] }
    : pathname.startsWith("/dashboard/pedidos/nuevo")
      ? { title: "Crear orden de compra", description: "Prepara un borrador para revisar antes de solicitar la compra.", steps: ["Selecciona el proveedor; se muestran productos asociados a él.", "Indica cantidad y precio unitario estimado; el total se calcula automáticamente.", "Guarda el borrador, ábrelo y pulsa “Solicitar Pedido” cuando esté revisado."], tips: ["Guardar no envía la orden al proveedor ni manda un correo. El envío automático de correos aún no está configurado.", "Comprueba proveedor, productos, cantidades y precios antes de solicitar."] }
      : pathname.startsWith("/dashboard/pedidos/")
        ? { title: "Detalle de la orden", description: "Revisa y gestiona el estado operativo de la orden de compra.", steps: ["Confirma proveedor, productos, cantidades y total estimado.", "Solicita el pedido solo cuando el borrador esté aprobado.", "Registra cada entrega desde Recepción Técnica; las entregas parciales conservan el saldo pendiente."], tips: ["Solicitar cambia el estado en el sistema, pero no envía correo al proveedor.", "Revisa los datos antes de solicitar la orden."] }
        : pathname === "/dashboard/pedidos"
          ? { title: "Órdenes de compra", description: "Da seguimiento a borradores, pedidos solicitados, recepciones parciales y pedidos completados.", steps: ["Usa las pestañas de estado para filtrar la lista.", "Abre un pedido para revisar proveedor, productos y cantidades pendientes.", "Crea un borrador nuevo cuando necesites reabastecer."], tips: ["Los pedidos solicitados o parcialmente recibidos también aparecen en Recepción Técnica.", "Crear o solicitar un pedido no envía correo automático al proveedor."] }
          : pathname.startsWith("/dashboard/recepcion/")
            ? { title: "Inspección técnica de recepción", description: "Registra una entrega parcial o total y los datos de lote antes de incorporar existencias.", steps: ["Ingresa solo la cantidad que llegó; para lo que no llegó, deja cero y lote/vencimiento vacíos.", "Para cada producto recibido, registra factura, lote, vencimiento, área y ubicación.", "El resultado global se aplica a todos los lotes incluidos: aprobado para uso o no aprobado/en cuarentena."], tips: ["La opción no aprobada deja los lotes en cuarentena; no existe una opción separada para rechazarlos.", "Si los lotes requieren resultados distintos, regístralos en recepciones separadas.", "El lote y vencimiento se ingresan manualmente; esta pantalla no usa escáner."] }
            : pathname === "/dashboard/recepcion"
              ? { title: "Recepción técnica y trazabilidad", description: "Abre las órdenes solicitadas para inspeccionar y registrar lo que llegó.", steps: ["Selecciona una orden solicitada o parcialmente recibida.", "Verifica empaque, temperatura, factura y cantidades.", "Registra manualmente lote, vencimiento, área y ubicación para cada producto recibido."], tips: ["En una recepción parcial registra solo lo que llegó; el saldo queda pendiente.", "No se envía un correo ni se crea una orden nueva desde esta pantalla."] }
              : pathname.startsWith("/dashboard/proveedores/evaluacion")
                ? { title: "Evaluación de proveedores", description: "Guarda una evaluación del proveedor para apoyar decisiones de compra.", steps: ["Selecciona el proveedor y confirma el correo de contacto de la evaluación.", "Responde las preguntas aplicables y califica calidad, entrega y soporte.", "Añade observaciones y guarda; el resultado se calcula con las respuestas aplicables."], tips: ["Sustenta calificaciones bajas con hechos, fechas o evidencia verificable."] }
                : pathname === "/dashboard/proveedores"
                  ? { title: "Gestión de proveedores", description: "Administra los datos y estado de proveedores usados en compras y evaluaciones.", steps: ["Busca el proveedor o registra uno nuevo.", "Registra nombre, contacto, correo e identificación cuando estén disponibles.", "Consulta sus evaluaciones antes de nuevas compras."], tips: ["El correo guardado aparece en el pedido, pero no se usa para envío automático. Inactivar evita seleccionarlo en pedidos nuevos y conserva el historial."] }
                  : pathname.startsWith("/dashboard/monitoreo")
                    ? { title: "Monitoreo ambiental", description: "Registra una lectura por ubicación y turno AM/PM; se evitan duplicados salvo que se indique una corrección.", steps: ["Selecciona la ubicación monitoreada.", "Ingresa la temperatura observada; la humedad es opcional.", "Anota desviaciones y acciones realizadas. Para corregir una lectura, marca corrección e indica el motivo."], tips: ["Compara la lectura con los límites validados para esa ubicación y los requisitos del fabricante.", "El sistema no tiene límites configurables por ubicación; la gráfica y el historial muestran lecturas, pero no determinan si cumplen un rango específico."] }
                    : pathname.startsWith("/dashboard/equipos/")
                      ? { title: "Hoja de vida del equipo", description: "Consulta la identificación y los registros de mantenimiento/calibración del equipo.", steps: ["Verifica modelo, serial y ubicación.", "Registra mantenimientos o calibraciones con su fecha y responsable.", "Actualiza la próxima intervención cuando corresponda."], tips: ["Conserva los soportes técnicos asociados a cada intervención."] }
                      : pathname === "/dashboard/equipos"
                        ? { title: "Gestión de equipos", description: "Registra equipos y conserva su identificación, ubicación, estado e historial técnico.", steps: ["Registra o selecciona un equipo.", "Selecciona Activo, En mantenimiento o Fuera de servicio según la situación actual.", "Programa mantenimiento preventivo o correctivo."], tips: ["El indicador operativo cuenta solo equipos en estado Activo; no bloquea automáticamente su uso en todos los módulos."] }
                        : pathname.startsWith("/dashboard/auditoria/checklist")
                          ? { title: "Checklist de cumplimiento", description: "Consulta las capacidades y controles descritos para el sistema.", steps: ["Usa cada categoría para ubicar el módulo relacionado.", "Contrasta la capacidad con la configuración y evidencia real del laboratorio.", "Documenta la evidencia en los registros y procedimientos correspondientes."], tips: ["Esta pantalla es informativa: no audita documentos automáticamente ni certifica el cumplimiento normativo del laboratorio."] }
                          : pathname.startsWith("/dashboard/auditoria/cumplimiento")
                            ? { title: "Cumplimiento normativo", description: "Consulta equipos activos, alertas de calidad y cobertura de mantenimiento preventivo vigente.", steps: ["Revisa cuántos equipos están activos y cuántos tienen mantenimiento preventivo vigente.", "Abre las alertas para consultar el registro relacionado.", "Registra la acción correctiva en el módulo que corresponda."], tips: ["La cobertura de mantenimiento no es un porcentaje general de cumplimiento ISO ni de habilitación; se calcula con equipos activos y sus fechas preventivas."] }
                            : pathname === "/dashboard/auditoria"
                              ? { title: "Auditoría y trazabilidad", description: "Consulta el registro de actividad para reconstruir quién realizó cada operación y cuándo.", steps: ["Revisa fecha, usuario, acción y entidad afectada.", "Inspecciona el detalle técnico del registro.", "Usa la información para investigar cambios o incidentes."], tips: ["El registro es de consulta; documenta correcciones mediante los flujos operativos correspondientes."] }
                              : pathname.startsWith("/dashboard/seguridad/reportar")
                                ? { title: "Reporte de incidente", description: "Documenta un incidente o desviación asociado a un producto, lote o evento clínico.", steps: ["Identifica tipo de evento, producto y lote.", "Describe fecha, hechos, impacto y acciones inmediatas.", "Envía el reporte y conserva los soportes para su investigación."], tips: ["Registra hechos observables; el reporte no sustituye la contención física del lote cuando se requiere."] }
                                : pathname === "/dashboard/seguridad"
                                  ? { title: "Seguridad clínica", description: "Consulta los incidentes registrados y la información asociada.", steps: ["Revisa los incidentes registrados.", "Abre el detalle para consultar producto, lote y acciones.", "Usa el formulario de reporte para un evento nuevo."], tips: ["Confirma con el responsable qué acciones correctivas siguen abiertas; registrar un incidente no las cierra automáticamente."] }
                                  : pathname.startsWith("/dashboard/reportes")
                                    ? { title: "Reportes", description: "Consulta movimientos, suficiencia, vencimientos, bajas, seguridad, ambiente y valorización.", steps: ["Elige el reporte en las pestañas.", "Lee su descripción y configura los filtros disponibles; el periodo puede variar según el reporte.", "Revisa filtros y datos antes de exportar o imprimir."], tips: ["Mermas permite filtrar por causa y método; registros antiguos sin esos datos pueden mostrarse como “Sin especificar”. La valorización es estimada y depende del precio guardado en el catálogo."] }
                                    : pathname.startsWith("/dashboard/usuarios")
                                      ? { title: "Gestión de usuarios", description: "Administra los roles de acceso de las cuentas existentes.", steps: ["Busca al usuario por nombre o correo.", "Selecciona el rol acorde con sus funciones y guarda el cambio.", "Si los permisos no se actualizan, pide al usuario volver a iniciar sesión."], tips: ["Asigna el menor nivel de acceso necesario; los permisos efectivos también dependen de las políticas de base de datos."] }
                                      : pathname.startsWith("/dashboard/configuracion")
                                        ? { title: "Configuración de maestros", description: "Administra áreas, ubicaciones, proveedores y productos usados por los demás módulos.", steps: ["Elige la pestaña del catálogo que vas a mantener.", "Verifica relaciones y estado antes de editar o inactivar un registro.", "Guarda y vuelve al módulo operativo para comprobar el cambio."], tips: ["Inactivar conserva el historial, pero puede quitar el registro de selectores nuevos. El stock mínimo es un umbral de reposición; ponerlo en cero no elimina la alerta si no hay stock utilizable."] }
                                        : { title: "Panel operativo", description: "Resume actividad, existencias, pedidos y alertas de stock o vencimiento.", steps: ["Revisa el tipo y la cantidad de alertas.", "Abre Inventario para verificar stock, mínimos, estado clínico y vencimientos.", "Atiende cada caso en el flujo correspondiente."], tips: ["Las alertas de stock son informativas y no bloquean salidas. El sistema mantiene alerta alta si el stock utilizable es cero, aunque el mínimo también sea cero."] };

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
        <ContextualHelp content={pageHelp} />
        <span className="app-version-badge" title={`Versión ${appVersion} · ${deploymentEnvironment}`}>
          v{appVersion} · {deploymentEnvironment === "production" ? "PROD" : deploymentEnvironment === "preview" ? "QA" : "DEV"}
        </span>
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
              <Link href="/dashboard" className="topbar-home-link">Operación clínica</Link>
              <ChevronRight aria-hidden="true" size={15} />
              <strong>{contextualPageTitle}</strong>
            </div>
            <div className="topbar-actions">
              <span className="app-version-badge" title={`Versión ${appVersion} · ${deploymentEnvironment}`}>
                v{appVersion} · {deploymentEnvironment === "production" ? "PROD" : deploymentEnvironment === "preview" ? "QA" : "DEV"}
              </span>
              <ContextualHelp content={pageHelp} />
              <span className="topbar-role">{user.role}</span>
              <span className="topbar-avatar" aria-hidden="true">{user.fullName.trim().charAt(0).toUpperCase()}</span>
              {!pathname.startsWith("/dashboard/inventario") && (
                <Link href="/dashboard/inventario?view=stock" className="topbar-link">Ver stock</Link>
              )}
            </div>
          </header>
          {children}
        </motion.main>
      </AnimatePresence>
    </div>
  );
}

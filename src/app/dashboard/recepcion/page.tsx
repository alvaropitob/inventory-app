import { OrderService } from "@/lib/services/orders";
import Link from "next/link";
import ContextualHelp from "@/components/ContextualHelp";
import { AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function RecepcionPage() {
  try {
    const allOrders = await OrderService.getOrders();
    const pendingOrders = (allOrders || []).filter(
      o => o.status === 'requested' || o.status === 'partially_received'
    );
    const requestedCount = pendingOrders.filter(order => order.status === 'requested').length;
    const partialCount = pendingOrders.filter(order => order.status === 'partially_received').length;

    return (
      <div className="dashboard-main">
        <div className="page-header">
          <div className="reception-page-heading">
            <div>
              <h1 className="page-header-title">Recepción Técnica y Trazabilidad</h1>
              <p className="page-header-subtitle">Inspecciona y registra los reactivos que llegan al laboratorio.</p>
            </div>
            <ContextualHelp content={{
              title: "Recepción técnica y trazabilidad",
              description: "Registra cada entrega vinculada a su orden antes de incorporar los productos al inventario.",
              steps: [
                "Abre una orden solicitada o parcialmente recibida.",
                "Compara productos, cantidades y documentos del proveedor.",
                "Registra lote, vencimiento, estado del empaque y condiciones de transporte.",
                "Aprueba, rechaza o deja en cuarentena según la inspección."
              ],
              tips: ["En una recepción parcial, registra solo lo que llegó y conserva pendiente el saldo de la orden."]
            }} />
          </div>
        </div>

        <section className="workflow-metrics reception-metrics" aria-label="Resumen de recepción">
          <article className="workflow-metric workflow-metric-info">
            <span>Órdenes pendientes</span><strong>{pendingOrders.length}</strong><small>Requieren recepción técnica</small>
          </article>
          <article className="workflow-metric workflow-metric-warning">
            <span>Solicitadas</span><strong>{requestedCount}</strong><small>Sin iniciar recepción</small>
          </article>
          <article className="workflow-metric">
            <span>Recepción parcial</span><strong>{partialCount}</strong><small>Con cantidades por completar</small>
          </article>
        </section>

        <div className="table-card reception-table-card">
          <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>No. Pedido</th>
                    <th>Proveedor</th>
                    <th>Fecha Esperada</th>
                    <th className="cell-center">Estado</th>
                    <th className="cell-right">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingOrders.length > 0 ? (
                    pendingOrders.map((order) => (
                      <tr key={order.id}>
                        <td className="cell-primary">{order.order_number}</td>
                        <td>{order.supplier?.name || "Sin proveedor asignado"}</td>
                        <td>{order.expected_delivery_date ? new Date(order.expected_delivery_date).toLocaleDateString('es-CO') : 'No definida'}</td>
                        <td className="cell-center">
                          <span className={`pill-badge ${order.status === 'requested' ? 'pill-blue' : 'pill-amber'}`}>
                            {order.status === 'requested' ? 'Solicitado' : 'Rec. Parcial'}
                          </span>
                        </td>
                        <td className="cell-right">
                          <Link
                            href={`/dashboard/recepcion/${order.id}`}
                            className="btn-primary reception-start-link"
                          >
                            Iniciar Inspección
                          </Link>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="workflow-empty-state">
                        <strong>Sin recepciones pendientes</strong>
                        <span>No hay pedidos que requieran inspección técnica.</span>
                      </td>
                    </tr>
                  )}
                </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    console.error("Error rendering RecepcionPage:", error);
    return (
      <div className="dashboard-main">
        <div className="page-header reception-error-header">
          <div>
            <h1 className="page-header-title reception-error-title"><AlertTriangle className="ui-icon" aria-hidden="true" /> Error al cargar recepciones</h1>
            <p className="page-header-subtitle">Hubo un problema al conectar con el servicio de órdenes.</p>
          </div>
        </div>
        <div className="table-card reception-error-card">
          <p className="card-section-subtitle">Por favor, intenta recargar la página o volver al inicio.</p>
          <Link href="/dashboard/recepcion" className="btn-primary reception-start-link">
            Reintentar Carga
          </Link>
        </div>
      </div>
    );
  }
}

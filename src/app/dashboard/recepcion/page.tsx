import { OrderService } from "@/lib/services/orders";
import Link from "next/link";
import ContextualHelp from "@/components/ContextualHelp";

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div>
              <h1 className="page-header-title">Recepción Técnica y Trazabilidad</h1>
              <p className="page-header-subtitle">Inspecciona y registra los reactivos que llegan al laboratorio.</p>
            </div>
            <ContextualHelp
              content="La recepción técnica es el primer filtro de calidad. Debes inspeccionar la integridad de los empaques, la cadena de frío y la documentación del proveedor antes de ingresar cualquier producto al stock."
            />
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
                    <th style={{ textAlign: 'center' }}>Estado</th>
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
                        <td style={{ textAlign: 'center' }}>
                          <span className={`pill-badge ${order.status === 'requested' ? 'pill-blue' : 'pill-amber'}`}>
                            {order.status === 'requested' ? 'Solicitado' : 'Rec. Parcial'}
                          </span>
                        </td>
                        <td className="cell-right">
                          <Link
                            href={`/dashboard/recepcion/${order.id}`}
                            className="btn-primary"
                            style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', textDecoration: 'none' }}
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
        <div className="page-header" style={{ borderBottom: '2px solid var(--error)' }}>
          <div>
            <h1 className="page-header-title" style={{ color: 'var(--error)' }}>⚠️ Error al cargar recepciones</h1>
            <p className="page-header-subtitle">Hubo un problema al conectar con el servicio de órdenes.</p>
          </div>
        </div>
        <div className="table-card" style={{ padding: '2rem', textAlign: 'center' }}>
          <p className="card-section-subtitle" style={{ marginBottom: '1.5rem' }}>Por favor, intenta recargar la página o volver al inicio.</p>
          <Link href="/dashboard/recepcion" className="btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>
            Reintentar Carga
          </Link>
        </div>
      </div>
    );
  }
}

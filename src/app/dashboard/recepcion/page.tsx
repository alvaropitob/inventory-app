import { OrderService } from "@/lib/services/orders";
import Link from "next/link";
import ContextualHelp from "@/components/ContextualHelp";

export const dynamic = "force-dynamic";

export default async function RecepcionPage() {
  try {
    // Solo pedidos solicitados o parcialmente recibidos son aptos para recepción técnica
    const allOrders = await OrderService.getOrders();
    const pendingOrders = (allOrders || []).filter(o => o.status === 'requested' || o.status === 'partially_received');

    return (
      <div className="dashboard-main">
        <div className="welcome-section">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h1>Recepción Técnica y Trazabilidad</h1>
            <ContextualHelp 
              content="La recepción técnica es el primer filtro de calidad. Debes inspeccionar la integridad de los empaques, la cadena de frío y la documentación del proveedor antes de ingresar cualquier producto al stock." 
            />
          </div>
          <p>Inspecciona y registra los reactivos que llegan al laboratorio.</p>
        </div>

        <div className="stat-card" style={{ width: '100%', padding: '0', overflow: 'hidden', flexDirection: 'column', alignItems: 'stretch' }}>
          <div className="table-responsive">
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border)' }}>
                <tr>
                  <th style={{ padding: '1.25rem', fontSize: '0.8125rem', fontWeight: '700', color: 'var(--navy-light)', textTransform: 'uppercase' }}>No. Pedido</th>
                  <th style={{ padding: '1.25rem', fontSize: '0.8125rem', fontWeight: '700', color: 'var(--navy-light)', textTransform: 'uppercase' }}>Proveedor</th>
                  <th style={{ padding: '1.25rem', fontSize: '0.8125rem', fontWeight: '700', color: 'var(--navy-light)', textTransform: 'uppercase' }}>Fecha Esperada</th>
                  <th style={{ padding: '1.25rem', fontSize: '0.8125rem', fontWeight: '700', color: 'var(--navy-light)', textTransform: 'uppercase' }}>Estado</th>
                  <th style={{ padding: '1.25rem', fontSize: '0.8125rem', fontWeight: '700', color: 'var(--navy-light)', textTransform: 'uppercase' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {pendingOrders.length > 0 ? (
                  pendingOrders.map((order) => (
                    <tr key={order.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '1.25rem', fontWeight: '700', color: 'var(--navy)' }}>{order.order_number}</td>
                      <td style={{ padding: '1.25rem' }}>{order.supplier?.name || "Sin proveedor asignado"}</td>
                      <td style={{ padding: '1.25rem' }}>{order.expected_delivery_date ? new Date(order.expected_delivery_date).toLocaleDateString() : 'No definida'}</td>
                      <td style={{ padding: '1.25rem' }}>
                        <span style={{ 
                          padding: '0.375rem 0.75rem', 
                          borderRadius: '20px', 
                          fontSize: '0.7rem', 
                          fontWeight: '800',
                          background: '#e0f2fe',
                          color: '#0369a1',
                          textTransform: 'uppercase'
                        }}>
                          {order.status === 'requested' ? 'Solicitado' : 'Rec. Parcial'}
                        </span>
                      </td>
                      <td style={{ padding: '1.25rem' }}>
                        <Link 
                          href={`/dashboard/recepcion/${order.id}`}
                          className="btn-primary"
                          style={{ padding: '0.5rem 1rem', fontSize: '0.75rem' }}
                        >
                          Iniciar Inspección
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No hay pedidos pendientes de recepción técnica.
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
        <div className="welcome-section" style={{ borderBottom: '2px solid var(--error)' }}>
          <h1 style={{ color: 'var(--error)' }}>⚠️ Error al cargar recepciones</h1>
          <p>Hubo un problema al conectar con el servicio de órdenes. Por favor, intenta recargar la página o contacta a soporte.</p>
        </div>
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
          <p style={{ marginBottom: '1.5rem', color: 'var(--text-muted)' }}>Por favor, intenta recargar la página o volver al inicio.</p>
          <Link href="/dashboard/recepcion" className="btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>Reintentar Carga</Link>
        </div>
      </div>
    );
  }
}

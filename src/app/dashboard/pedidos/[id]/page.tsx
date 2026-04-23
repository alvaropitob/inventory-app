import { OrderService } from "@/lib/services/orders";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

function OrderStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; cls: string }> = {
    draft:              { label: 'Borrador',     cls: 'pill-slate' },
    requested:          { label: 'Solicitado',   cls: 'pill-blue'  },
    partially_received: { label: 'Rec. Parcial', cls: 'pill-amber' },
    completed:          { label: 'Completado',   cls: 'pill-green' },
    cancelled:          { label: 'Cancelado',    cls: 'pill-red'   },
  };
  const { label, cls } = config[status] ?? { label: status, cls: 'pill-slate' };
  return <span className={`pill-badge ${cls}`}>{label}</span>;
}

function ReceivedQtyClass(received: number, requested: number) {
  if (received === requested) return 'qty-ok';
  if (received === 0) return 'qty-pending';
  return 'qty-partial';
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const order = await OrderService.getOrderById(id);
    if (!order) return notFound();

    return (
      <div className="dashboard-main">
        <div className="page-header">
          <div>
            <h1 className="page-header-title">Pedido {order.order_number}</h1>
            <p className="page-header-subtitle">Detalles completos de la requisición de materiales.</p>
          </div>
          <div className="page-header-actions">
            <Link href="/dashboard/pedidos" className="btn-secondary" style={{ textDecoration: 'none' }}>
              &larr; Volver
            </Link>

            {order.status === 'draft' && (
              <>
                <form action={async () => {
                  'use server';
                  const { updateOrderStatusAction } = await import('../actions');
                  await updateOrderStatusAction(order.id!, 'cancelled');
                }}>
                  <button type="submit" className="btn-secondary" style={{ color: 'var(--error)', borderColor: 'var(--error)' }}>
                    Cancelar Pedido
                  </button>
                </form>

                <form action={async () => {
                  'use server';
                  const { updateOrderStatusAction } = await import('../actions');
                  await updateOrderStatusAction(order.id!, 'requested');
                }}>
                  <button type="submit" className="btn-primary">
                    🚀 Solicitar Pedido
                  </button>
                </form>
              </>
            )}

            {(order.status === 'requested' || order.status === 'partially_received') && (
              <Link
                href={`/dashboard/recepcion/${order.id}`}
                className="btn-primary"
                style={{ textDecoration: 'none', background: '#0891b2' }}
              >
                📥 Iniciar Recepción
              </Link>
            )}
          </div>
        </div>

        <div className="info-grid">
          <div className="info-card">
            <h3 className="info-card-title">Información del Pedido</h3>
            <p className="info-card-row"><strong>Estado:</strong> <OrderStatusBadge status={order.status} /></p>
            <p className="info-card-row"><strong>Fecha Emisión:</strong> {order.created_at && new Date(order.created_at).toLocaleDateString()}</p>
            <p className="info-card-row"><strong>Fecha Estimada Entrega:</strong> {order.expected_delivery_date ? new Date(order.expected_delivery_date).toLocaleDateString() : 'No especificada'}</p>
            <p className="info-card-row"><strong>Creado por:</strong> {order.creator?.full_name}</p>
            {order.notes && <p className="info-card-row"><strong>Notas:</strong> {order.notes}</p>}
          </div>

          <div className="info-card">
            <h3 className="info-card-title">Datos del Proveedor</h3>
            <p className="info-card-row"><strong>Nombre:</strong> {order.supplier?.name}</p>
            <p className="info-card-row"><strong>Contacto:</strong> {order.supplier?.contact_name || 'N/A'}</p>
            <p className="info-card-row"><strong>Email:</strong> {order.supplier?.contact_email || 'N/A'}</p>
          </div>
        </div>

        <div className="table-card">
          <div className="card-section-header">
            <h3 className="card-section-title">Productos Solicitados</h3>
          </div>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Producto</th>
                  <th className="cell-center">Cant. Solicitada</th>
                  <th className="cell-center">Cant. Recibida</th>
                  <th className="cell-right">P.Unit Est.</th>
                  <th className="cell-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {order.items?.map((item) => (
                  <tr key={item.id}>
                    <td>{item.catalog_item?.internal_code}</td>
                    <td>
                      <div className="cell-primary">{item.catalog_item?.technical_name}</div>
                      <div className="cell-muted">{item.catalog_item?.commercial_name}</div>
                    </td>
                    <td className="cell-center" style={{ fontWeight: 600 }}>{item.quantity_requested}</td>
                    <td className="cell-center">
                      <span className={ReceivedQtyClass(item.quantity_received ?? 0, item.quantity_requested ?? 0)}>
                        {item.quantity_received}
                      </span>
                    </td>
                    <td className="cell-right">${item.estimated_unit_price?.toFixed(2)}</td>
                    <td className="cell-right cell-value">
                      ${((item.quantity_requested || 0) * (item.estimated_unit_price || 0)).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--bg-app)' }}>
                  <td colSpan={5} className="cell-right" style={{ padding: '1rem', fontWeight: 700, fontSize: '1rem' }}>TOTAL ESTIMADO:</td>
                  <td className="cell-right" style={{ padding: '1rem', fontWeight: 700, fontSize: '1.2rem', color: 'var(--primary)' }}>
                    ${order.total_estimated_value?.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    );
  } catch {
    return notFound();
  }
}

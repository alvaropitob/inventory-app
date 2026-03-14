import { OrderService } from "@/lib/services/orders";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const order = await OrderService.getOrderById(id);
    if (!order) return notFound();

    const getStatusBadge = (status: string) => {
      switch (status) {
        case 'draft': return <span style={{ padding: '0.25rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700', background: '#f1f5f9', color: '#475569', textTransform: 'uppercase' }}>Borrador</span>;
        case 'requested': return <span style={{ padding: '0.25rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700', background: '#dbeafe', color: '#1d4ed8', textTransform: 'uppercase' }}>Solicitado</span>;
        case 'partially_received': return <span style={{ padding: '0.25rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700', background: '#fef3c7', color: '#d97706', textTransform: 'uppercase' }}>Recibido Parcial</span>;
        case 'completed': return <span style={{ padding: '0.25rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700', background: '#dcfce7', color: '#166534', textTransform: 'uppercase' }}>Completado</span>;
        case 'cancelled': return <span style={{ padding: '0.25rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700', background: '#fee2e2', color: '#991b1b', textTransform: 'uppercase' }}>Cancelado</span>;
        default: return null;
      }
    };

    return (
      <div className="dashboard-main">
        <div className="welcome-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1>Pedido {order.order_number}</h1>
            <p>Detalles completos de la requisición de materiales.</p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <Link href="/dashboard/pedidos" className="btn-secondary" style={{ textDecoration: 'none' }}>
              &larr; Volver
            </Link>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
          <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--navy)', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', width: '100%' }}>Información del Pedido</h3>
            <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}><strong>Estado:</strong> {getStatusBadge(order.status)}</p>
            <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}><strong>Fecha Emisión:</strong> {order.created_at && new Date(order.created_at).toLocaleDateString()}</p>
            <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}><strong>Fecha Estimada Entrega:</strong> {order.expected_delivery_date ? new Date(order.expected_delivery_date).toLocaleDateString() : 'No especificada'}</p>
            <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}><strong>Creado por:</strong> {order.creator?.full_name}</p>
            {order.notes && <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}><strong>Notas:</strong> {order.notes}</p>}
          </div>

          <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--navy)', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', width: '100%' }}>Datos del Proveedor</h3>
            <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}><strong>Nombre:</strong> {order.supplier?.name}</p>
            <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}><strong>Contacto:</strong> {order.supplier?.contact_name || 'N/A'}</p>
            <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}><strong>Email:</strong> {order.supplier?.contact_email || 'N/A'}</p>
          </div>
        </div>

        <div className="stat-card" style={{ width: '100%', padding: '0', overflow: 'hidden', flexDirection: 'column', alignItems: 'stretch' }}>
          <h3 style={{ padding: '1.25rem', margin: 0, borderBottom: '1px solid var(--border)', background: 'var(--bg-app)', fontSize: '1.1rem', color: 'var(--navy)' }}>
            Productos Solicitados
          </h3>
          <div className="table-responsive">
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ background: 'white', borderBottom: '1px solid var(--border)' }}>
                <tr>
                  <th style={{ padding: '1rem', fontSize: '0.8125rem', fontWeight: '700', color: 'var(--navy-light)', textTransform: 'uppercase' }}>Código</th>
                  <th style={{ padding: '1rem', fontSize: '0.8125rem', fontWeight: '700', color: 'var(--navy-light)', textTransform: 'uppercase' }}>Producto</th>
                  <th style={{ padding: '1rem', fontSize: '0.8125rem', fontWeight: '700', color: 'var(--navy-light)', textTransform: 'uppercase', textAlign: 'center' }}>Cant. Solicitada</th>
                  <th style={{ padding: '1rem', fontSize: '0.8125rem', fontWeight: '700', color: 'var(--navy-light)', textTransform: 'uppercase', textAlign: 'center' }}>Cant. Recibida</th>
                  <th style={{ padding: '1rem', fontSize: '0.8125rem', fontWeight: '700', color: 'var(--navy-light)', textTransform: 'uppercase', textAlign: 'right' }}>P.Unit Est.</th>
                  <th style={{ padding: '1rem', fontSize: '0.8125rem', fontWeight: '700', color: 'var(--navy-light)', textTransform: 'uppercase', textAlign: 'right' }}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {order.items?.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '1rem', fontSize: '0.85rem' }}>{item.catalog_item?.internal_code}</td>
                    <td style={{ padding: '1rem', fontWeight: '500' }}>{item.catalog_item?.commercial_name || item.catalog_item?.technical_name}</td>
                    <td style={{ padding: '1rem', textAlign: 'center', fontWeight: '600' }}>{item.quantity_requested}</td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <span style={{ color: item.quantity_received === item.quantity_requested ? 'var(--success)' : (item.quantity_received === 0 ? 'var(--text-muted)' : 'var(--warning)'), fontWeight: '600' }}>
                        {item.quantity_received}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>${item.estimated_unit_price?.toFixed(2)}</td>
                    <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '600' }}>${((item.quantity_requested || 0) * (item.estimated_unit_price || 0)).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: '#f8fafc' }}>
                  <td colSpan={5} style={{ padding: '1rem', textAlign: 'right', fontWeight: '700', fontSize: '1rem' }}>TOTAL ESTIMADO:</td>
                  <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '700', fontSize: '1.2rem', color: 'var(--primary)' }}>${order.total_estimated_value?.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    return notFound();
  }
}

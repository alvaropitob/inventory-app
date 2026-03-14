import { OrderService, OrderStatus } from "@/lib/services/orders";
import Link from "next/link";
import ExportCSVButton from "@/components/ExportCSVButton";

export const dynamic = "force-dynamic";

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const currentStatus = (searchParams.status as OrderStatus) || "";
  
  const orders = await OrderService.getOrders(
    currentStatus ? { status: currentStatus } : undefined
  );

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
          <h1>Gestión de Pedidos</h1>
          <p>Administra las requisiciones de compra y abastecimiento a proveedores.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <ExportCSVButton 
            filename="Pedidos_Compra" 
            data={orders.map(o => ({
              'Número de Pedido': o.order_number,
              'Fecha': o.created_at ? new Date(o.created_at).toLocaleDateString() : '',
              'Proveedor': o.supplier?.name || 'Desconocido',
              'Estado': o.status,
              'Total Estimado': o.total_estimated_value ? `$${o.total_estimated_value}` : '$0.00',
              'Creado por': o.creator?.full_name || 'Desconocido'
            }))} 
          />
          <Link href="/dashboard/pedidos/nuevo" className="btn-primary" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="M12 5v14" />
            </svg>
            Nuevo Pedido
          </Link>
        </div>
      </div>

      <div className="filters-section" style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <Link 
          href="/dashboard/pedidos" 
          style={{ padding: '0.5rem 1rem', borderRadius: '8px', background: !currentStatus ? 'var(--primary)' : 'white', color: !currentStatus ? 'white' : 'var(--text)', border: '1px solid var(--border)', textDecoration: 'none', fontSize: '0.875rem', fontWeight: '500' }}
        >
          Todos
        </Link>
        <Link 
          href="/dashboard/pedidos?status=draft" 
          style={{ padding: '0.5rem 1rem', borderRadius: '8px', background: currentStatus === 'draft' ? 'var(--primary)' : 'white', color: currentStatus === 'draft' ? 'white' : 'var(--text)', border: '1px solid var(--border)', textDecoration: 'none', fontSize: '0.875rem', fontWeight: '500' }}
        >
          Borradores
        </Link>
        <Link 
          href="/dashboard/pedidos?status=requested" 
          style={{ padding: '0.5rem 1rem', borderRadius: '8px', background: currentStatus === 'requested' ? 'var(--primary)' : 'white', color: currentStatus === 'requested' ? 'white' : 'var(--text)', border: '1px solid var(--border)', textDecoration: 'none', fontSize: '0.875rem', fontWeight: '500' }}
        >
          Solicitados
        </Link>
        <Link 
          href="/dashboard/pedidos?status=completed" 
          style={{ padding: '0.5rem 1rem', borderRadius: '8px', background: currentStatus === 'completed' ? 'var(--primary)' : 'white', color: currentStatus === 'completed' ? 'white' : 'var(--text)', border: '1px solid var(--border)', textDecoration: 'none', fontSize: '0.875rem', fontWeight: '500' }}
        >
          Completados
        </Link>
      </div>

      <div className="stat-card" style={{ width: '100%', padding: '0', overflow: 'hidden', flexDirection: 'column', alignItems: 'stretch' }}>
        <div className="table-responsive">
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border)' }}>
              <tr>
                <th style={{ padding: '1.25rem', fontSize: '0.8125rem', fontWeight: '700', color: 'var(--navy-light)', textTransform: 'uppercase' }}>Pedido #</th>
                <th style={{ padding: '1.25rem', fontSize: '0.8125rem', fontWeight: '700', color: 'var(--navy-light)', textTransform: 'uppercase' }}>Fecha</th>
                <th style={{ padding: '1.25rem', fontSize: '0.8125rem', fontWeight: '700', color: 'var(--navy-light)', textTransform: 'uppercase' }}>Proveedor</th>
                <th style={{ padding: '1.25rem', fontSize: '0.8125rem', fontWeight: '700', color: 'var(--navy-light)', textTransform: 'uppercase' }}>Estado</th>
                <th style={{ padding: '1.25rem', fontSize: '0.8125rem', fontWeight: '700', color: 'var(--navy-light)', textTransform: 'uppercase', textAlign: 'right' }}>Total Estimado</th>
                <th style={{ padding: '1.25rem', fontSize: '0.8125rem', fontWeight: '700', color: 'var(--navy-light)', textTransform: 'uppercase', textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}>
                  <td style={{ padding: '1.25rem' }}>
                    <div style={{ fontWeight: '600', color: 'var(--navy)' }}>{order.order_number}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Creado por: {order.creator?.full_name?.split(' ')[0]}</div>
                  </td>
                  <td style={{ padding: '1.25rem', fontSize: '0.85rem' }}>
                    {order.created_at && new Date(order.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '1.25rem', fontSize: '0.85rem', fontWeight: '500' }}>
                    {order.supplier?.name}
                  </td>
                  <td style={{ padding: '1.25rem' }}>
                    {getStatusBadge(order.status)}
                  </td>
                  <td style={{ padding: '1.25rem', fontSize: '0.85rem', fontWeight: '600', textAlign: 'right' }}>
                    ${order.total_estimated_value?.toFixed(2) || '0.00'}
                  </td>
                  <td style={{ padding: '1.25rem', textAlign: 'center' }}>
                    <Link href={`/dashboard/pedidos/${order.id}`} style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: '0.85rem', fontWeight: '600' }}>
                      Ver detalle →
                    </Link>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No hay pedidos que coincidan con los filtros actuales.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

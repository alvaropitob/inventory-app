import { OrderService, OrderStatus } from "@/lib/services/orders";
import Link from "next/link";
import ExportCSVButton from "@/components/ExportCSVButton";

export const dynamic = "force-dynamic";

function OrderStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    draft:              { label: 'Borrador',        className: 'pill-slate'  },
    requested:          { label: 'Solicitado',      className: 'pill-blue'   },
    partially_received: { label: 'Rec. Parcial',    className: 'pill-amber'  },
    completed:          { label: 'Completado',       className: 'pill-green'  },
    cancelled:          { label: 'Cancelado',        className: 'pill-red'    },
  };
  const { label, className } = config[status] ?? { label: status, className: 'pill-slate' };
  return <span className={`pill-badge ${className}`}>{label}</span>;
}

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const currentStatus = (status as OrderStatus) || "";

  const allOrders = await OrderService.getOrders();
  const orders = currentStatus ? allOrders.filter(order => order.status === currentStatus) : allOrders;
  const requestedOrders = allOrders.filter(order => order.status === 'requested');
  const partialOrders = allOrders.filter(order => order.status === 'partially_received');
  const completedOrders = allOrders.filter(order => order.status === 'completed');

  const filters = [
    { label: 'Todos',        href: '/dashboard/pedidos',                    active: !currentStatus },
    { label: 'Borradores',   href: '/dashboard/pedidos?status=draft',       active: currentStatus === 'draft' },
    { label: 'Solicitados',  href: '/dashboard/pedidos?status=requested',   active: currentStatus === 'requested' },
    { label: 'Recepción parcial', href: '/dashboard/pedidos?status=partially_received', active: currentStatus === 'partially_received' },
    { label: 'Completados',  href: '/dashboard/pedidos?status=completed',   active: currentStatus === 'completed' },
    { label: 'Cancelados',   href: '/dashboard/pedidos?status=cancelled',   active: currentStatus === 'cancelled' },
  ];

  return (
    <div className="dashboard-main">
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Gestión de Pedidos</h1>
          <p className="page-header-subtitle">Administra las requisiciones de compra y abastecimiento a proveedores.</p>
        </div>
        <div className="page-header-actions">
          <ExportCSVButton
            filename="Pedidos_Compra"
            data={orders.map(o => ({
              'Número de Pedido': o.order_number,
              'Fecha': o.created_at ? new Date(o.created_at).toLocaleDateString('es-CO') : '',
              'Proveedor': o.supplier?.name || 'Desconocido',
              'Estado': o.status,
              'Total Estimado': o.total_estimated_value ? `$${o.total_estimated_value}` : '$0.00',
              'Creado por': o.creator?.full_name || 'Desconocido',
            }))}
          />
          <Link href="/dashboard/pedidos/nuevo" className="btn-primary" style={{ textDecoration: 'none' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" /><path d="M12 5v14" />
            </svg>
            Nuevo Pedido
          </Link>
        </div>
      </div>

      <section className="workflow-metrics" aria-label="Resumen de pedidos">
        <article className="workflow-metric">
          <span>Total de pedidos</span><strong>{allOrders.length}</strong><small>En todos los estados</small>
        </article>
        <article className="workflow-metric workflow-metric-warning">
          <span>Solicitados</span><strong>{requestedOrders.length}</strong><small>Pendientes de recepción</small>
        </article>
        <article className="workflow-metric workflow-metric-info">
          <span>Recepción parcial</span><strong>{partialOrders.length}</strong><small>Pedidos con unidades pendientes</small>
        </article>
        <article className="workflow-metric workflow-metric-success">
          <span>Completados</span><strong>{completedOrders.length}</strong><small>Recepción finalizada</small>
        </article>
      </section>

      <nav className="filter-tabs">
        {filters.map(f => (
          <Link key={f.href} href={f.href} className={`filter-tab${f.active ? ' filter-tab-active' : ''}`}>
            {f.label}
          </Link>
        ))}
      </nav>

      <div className="table-card">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Pedido #</th>
                <th>Fecha</th>
                <th>Proveedor</th>
                <th>Estado</th>
                <th className="cell-right">Total Estimado</th>
                <th style={{ textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <div className="cell-primary">{order.order_number}</div>
                    <div className="cell-muted">Creado por: {order.creator?.full_name?.split(' ')[0]}</div>
                  </td>
                  <td>{order.created_at && new Date(order.created_at).toLocaleDateString('es-CO')}</td>
                  <td className="cell-secondary">{order.supplier?.name}</td>
                  <td><OrderStatusBadge status={order.status} /></td>
                  <td className="cell-right cell-value">${order.total_estimated_value?.toFixed(2) || '0.00'}</td>
                  <td style={{ textAlign: 'center' }}>
                    <Link href={`/dashboard/pedidos/${order.id}`} className="cell-link">
                      Ver detalle →
                    </Link>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
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

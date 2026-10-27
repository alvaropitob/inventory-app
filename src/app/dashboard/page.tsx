import { redirect } from "next/navigation";
import { CatalogService } from "@/lib/services/catalog";
import { StockService } from "@/lib/services/stock";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { OrderService } from "@/lib/services/orders";
import { getCurrentUserProfile } from "@/lib/services/user";
import Link from "next/link";
import { getDateKeyInBusinessTimeZone } from "@/lib/dates";
import { parseUnitsFromPresentation } from "@/lib/utils/presentation";

export const dynamic = "force-dynamic";

interface Batch {
  id: string;
  item_id: string;
  batch_number: string;
  expiration_date: string;
  adjusted_expiration_date?: string | null;
  current_stock: number;
  opened_units_remaining?: number;
  clinical_status?: 'accepted' | 'quarantine' | 'rejected' | string;
  item?: { technical_name: string };
  priority?: 'none' | 'medium' | 'high';
}

export default async function DashboardPage() {
  const user = await getCurrentUserProfile();

  if (!user) {
    redirect("/login");
  }

  const fullName = user.fullName;

  const { data: items } = await CatalogService.getCatalogItems();
  const { data: batches } = await StockService.getAllBatches();

  const orders = await OrderService.getOrders();
  const activeOrders = orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled' && o.status !== 'draft');

  const stockLevels = (items || []).map(item => {
    const itemBatches = (batches || []).filter(b => b.item_id === item.id);
    const todayKey = getDateKeyInBusinessTimeZone(new Date());
    const totalStock = itemBatches.filter(b => b.clinical_status === "accepted" && (b.adjusted_expiration_date || b.expiration_date) >= todayKey && b.status !== "expired")
      .reduce((sum, b) => {
        const unitsPerPackage = parseUnitsFromPresentation(item.commercial_presentation);
        return sum + b.current_stock + (unitsPerPackage ? (b.opened_units_remaining || 0) / unitsPerPackage : 0);
      }, 0);
    const threshold = item.minimum_stock_threshold || 0;

    let priority: 'none' | 'low' | 'medium' | 'high' = 'none';
    if (totalStock === 0) priority = 'high';
    else if (totalStock < threshold) priority = 'medium';
    else if (item.maximum_stock_threshold != null && totalStock > item.maximum_stock_threshold) priority = 'low';
    else if (totalStock < threshold * 1.5) priority = 'low';

    return { ...item, totalStock, priority };
  }).filter(item => item.priority !== 'none');

  const criticalStockCount = stockLevels.filter(s => s.priority === 'high' || s.priority === 'medium').length;

  const now = new Date();
  const next30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const expirationAlerts = (batches || []).filter(batch => (batch.current_stock > 0 || (batch.opened_units_remaining || 0) > 0) && batch.clinical_status === "accepted" && batch.status !== "expired").map(batch => {
    const expDate = new Date(batch.adjusted_expiration_date || batch.expiration_date);
    let priority: 'none' | 'medium' | 'high' = 'none';
    if (expDate <= now) priority = 'high';
    else if (expDate <= next30Days) priority = 'medium';
    return { ...batch, priority };
  }).filter(b => b.priority !== 'none');

  const criticalExpiry = expirationAlerts.filter(e => e.priority === 'high').length;
  const overStockCount = stockLevels.filter(s => s.maximum_stock_threshold != null && s.totalStock > s.maximum_stock_threshold).length;
  const totalAlerts = criticalStockCount + overStockCount + criticalExpiry;

  const totalInventoryValue = (items || []).reduce((acc, item) => {
    const itemBatches = (batches || []).filter(b => b.item_id === item.id && b.clinical_status === "accepted" && b.status !== "expired" && (b.adjusted_expiration_date || b.expiration_date) >= getDateKeyInBusinessTimeZone(new Date()));
    const totalStock = itemBatches.reduce((sum, b) => {
      const unitsPerPackage = parseUnitsFromPresentation(item.commercial_presentation);
      return sum + (b.current_stock || 0) + (unitsPerPackage ? (b.opened_units_remaining || 0) / unitsPerPackage : 0);
    }, 0);
    const price = Number(item.estimated_unit_price || 0);
    return acc + (totalStock * price);
  }, 0);

  return (
    <div className="dashboard-main">

      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Panel de Control</h1>
          <p className="page-header-subtitle">Bienvenido de nuevo, {fullName}. Aquí tienes un resumen de la operación.</p>
        </div>
        <div className="page-header-actions">
          <Link href="/dashboard/inventario?view=entradas" className="btn-secondary" style={{ textDecoration: 'none' }} aria-label="Registrar entrada manual de producto e inventario, sin asociarla a un pedido" title="Da de alta un producto y sus existencias sin asociarlos a un pedido. Para compras, usa Nuevo Pedido.">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Entrada manual
          </Link>
          <Link href="/dashboard/pedidos/nuevo" className="btn-primary" style={{ textDecoration: 'none' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Nuevo Pedido
          </Link>
        </div>
      </div>

      <section
        className={`dashboard-alert ${totalAlerts > 0 ? "dashboard-alert-critical" : "dashboard-alert-ok"}`}
        role={totalAlerts > 0 ? "alert" : "status"}
        aria-live="polite"
      >
        <div className="dashboard-alert-indicator" aria-hidden="true">
          {totalAlerts > 0 ? <AlertTriangle className="ui-icon" aria-hidden="true" /> : <CheckCircle2 className="ui-icon" aria-hidden="true" />}
        </div>
        <div className="dashboard-alert-copy">
          <strong>{totalAlerts > 0 ? `${totalAlerts} alertas requieren revisión` : "Inventario dentro de parámetros"}</strong>
          <span>
            {totalAlerts > 0
              ? `${criticalStockCount} productos bajo el mínimo, ${overStockCount} sobre el máximo y ${criticalExpiry} lotes vencidos.`
              : "No se detectan productos bajo el mínimo o sobre el máximo ni lotes vencidos."}
          </span>
        </div>
        <Link href="/dashboard/inventario?view=stock" className="dashboard-alert-link">
          Revisar inventario <span aria-hidden="true">→</span>
        </Link>
      </section>

      {/* KPI Cards */}
      <div className="kpi-grid dashboard-kpi-grid stagger-in">
        <div className="kpi-card">
          <div className="kpi-card-header">
            <h3 className="kpi-card-label">Valor del Inventario</h3>
            <div className="kpi-icon kpi-icon-blue">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="1" x2="12" y2="23"/>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            </div>
          </div>
          <div className="kpi-value" style={{ fontSize: 'var(--fs-lg)' }}>
            ${totalInventoryValue.toLocaleString('es-CO')}
          </div>
          <p className="kpi-meta kpi-meta-success">Capital activo en stock</p>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-header">
            <h3 className="kpi-card-label">Productos Únicos</h3>
            <div className="kpi-icon kpi-icon-blue">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              </svg>
            </div>
          </div>
          <div className="kpi-value">{items?.length || 0}</div>
          <p className="kpi-meta kpi-meta-muted">En catálogo maestro</p>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-header">
            <h3 className="kpi-card-label">Pedidos en Curso</h3>
            <div className="kpi-icon kpi-icon-amber">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <path d="M16 10a4 4 0 0 1-8 0"/>
              </svg>
            </div>
          </div>
          <div className="kpi-value">{activeOrders.length}</div>
          <p className="kpi-meta kpi-meta-muted">Pendientes de entrega</p>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-header">
            <h3 className="kpi-card-label">Lotes Aceptados</h3>
            <div className="kpi-icon kpi-icon-green">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <line x1="3" y1="9" x2="21" y2="9"/>
                <line x1="9" y1="21" x2="9" y2="9"/>
              </svg>
            </div>
          </div>
          <div className="kpi-value">
            {batches?.filter((b: Batch) => b.clinical_status === 'accepted').length || 0}
          </div>
          <p className="kpi-meta kpi-meta-success">Listos para uso clínico</p>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-header">
            <h3 className="kpi-card-label">Alertas Críticas</h3>
            <div className="kpi-icon kpi-icon-red">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
          </div>
          <div className="kpi-value" style={{ color: totalAlerts > 0 ? 'var(--error)' : 'inherit' }}>
            {totalAlerts}
          </div>
          <p className="kpi-meta" style={{ color: totalAlerts > 0 ? 'var(--error)' : 'var(--text-muted)' }}>
            {criticalStockCount} stock bajo, {criticalExpiry} vencidos
          </p>
        </div>
      </div>

      {/* Detail Grid */}
      <div className="detail-grid stagger-in">

        {/* Left Column */}
        <div className="detail-col">

          {/* Stock Alerts */}
          <div className="data-card">
            <div className="data-card-header">
              <h2 className="data-card-title">
                <span className="status-dot status-dot-danger" />
                Productos con Stock Crítico
              </h2>
              <Link href="/dashboard/inventario?view=stock" className="data-card-link">Ver stock &rarr;</Link>
            </div>
            <div className="data-card-body">
              {stockLevels.filter(s => s.priority === 'high' || s.priority === 'medium').length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon empty-state-icon-success">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </div>
                  <p className="empty-state-title">Estado Saludable</p>
                  <p className="empty-state-text">Todos los productos superan el mínimo establecido.</p>
                </div>
              ) : (
                <table className="inline-table">
                  <tbody>
                    {stockLevels
                      .filter(s => s.priority === 'high' || s.priority === 'medium')
                      .sort((a, b) => a.totalStock - b.totalStock)
                      .slice(0, 5)
                      .map((item) => (
                        <tr key={item.id}>
                          <td>
                            <div className="cell-primary">{item.commercial_name || item.technical_name}</div>
                            <div className="cell-muted">Mínimo requerido: {item.minimum_stock_threshold} {item.purchase_unit}</div>
                          </td>
                          <td className="cell-right">
                            <span className={item.priority === 'high' ? 'cell-stock-danger' : 'cell-stock-warning'}>
                              {item.totalStock} <span className="cell-unit">{item.usage_unit || item.purchase_unit}</span>
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Active Orders */}
          <div className="data-card">
            <div className="data-card-header">
              <h2 className="data-card-title">
                <span className="status-dot status-dot-warning" />
                Pedidos Recientes (Pendientes)
              </h2>
              <Link href="/dashboard/pedidos" className="data-card-link">Ver todo &rarr;</Link>
            </div>
            <div className="data-card-body">
              {activeOrders.length === 0 ? (
                <div className="empty-state">
                  <p className="empty-state-text">No hay pedidos pendientes de entrega.</p>
                </div>
              ) : (
                <table className="inline-table">
                  <thead>
                    <tr>
                      <th>Pedido</th>
                      <th>Proveedor</th>
                      <th className="cell-right">Estimado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeOrders.slice(0, 4).map((order) => (
                      <tr key={order.id}>
                        <td>
                          <Link href={`/dashboard/pedidos/${order.id}`} className="cell-link">{order.order_number}</Link>
                          <div style={{ marginTop: '0.25rem' }}>
                            <span className={`pill-badge ${order.status === 'requested' ? 'pill-blue' : 'pill-amber'}`}>
                              {order.status === 'requested' ? 'Solicitado' : 'Recibido Parcial'}
                            </span>
                          </div>
                        </td>
                        <td className="cell-secondary">{order.supplier?.name}</td>
                        <td className="cell-right cell-value">${order.total_estimated_value?.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Expirations */}
        <div className="detail-col">
          <div className="data-card">
            <div className="data-card-header">
              <h2 className="data-card-title">
                <span className="status-dot status-dot-primary" />
                Próximos a Vencer
              </h2>
            </div>
            <div className="data-card-body">
              {expirationAlerts.filter(e => e.priority === 'high' || e.priority === 'medium').length === 0 ? (
                <div className="empty-state">
                  <p className="empty-state-text">No hay lotes con riesgo de caducidad en los próximos 30 días.</p>
                </div>
              ) : (
                <div className="expiry-list">
                  {expirationAlerts
                    .filter(e => e.priority === 'high' || e.priority === 'medium')
                    .sort((a, b) => new Date(a.adjusted_expiration_date || a.expiration_date).getTime() - new Date(b.adjusted_expiration_date || b.expiration_date).getTime())
                    .slice(0, 6)
                    .map((batch: Batch) => {
                      const cStatus = batch.clinical_status || 'accepted';
                      return (
                        <div key={batch.id} className="expiry-item">
                          <div className="expiry-item-top">
                            <span className="expiry-item-name">
                              {(batch as { item?: { technical_name: string } }).item?.technical_name}
                            </span>
                            <span className={batch.priority === 'high' ? 'expiry-item-date-danger' : 'expiry-item-date-warning'}>
                              {new Date(batch.adjusted_expiration_date || batch.expiration_date).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="expiry-item-bottom">
                            <span>Lote: {batch.batch_number}</span>
                            <div className="expiry-item-meta">
                              <span className={`pill-badge ${cStatus === 'accepted' ? 'pill-green' : 'pill-amber'}`}>
                                {cStatus === 'accepted' ? 'Aceptado' : 'Cuarentena'}
                              </span>
                              <span className="expiry-stock">Stock: {batch.current_stock}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

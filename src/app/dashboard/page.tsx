import { redirect } from "next/navigation";
import { CatalogService } from "@/lib/services/catalog";
import { StockService } from "@/lib/services/stock";
import { OrderService } from "@/lib/services/orders";
import { getCurrentUserProfile } from "@/lib/services/user";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface Batch {
  id: string;
  item_id: string;
  batch_number: string;
  expiration_date: string;
  current_stock: number;
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
  
  // Fetch data
  const { data: items } = await CatalogService.getCatalogItems();
  const { data: batches } = await StockService.getAllBatches();
  
  // Get all active orders (not completed, not cancelled)
  const orders = await OrderService.getOrders();
  const activeOrders = orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled' && o.status !== 'draft');


  // Process Stock Alerts
  const stockLevels = (items || []).map(item => {
    const itemBatches = (batches || []).filter(b => b.item_id === item.id);
    const totalStock = itemBatches.reduce((sum, b) => sum + b.current_stock, 0);
    const threshold = item.minimum_stock_threshold || 0;
    
    let priority: 'none' | 'low' | 'medium' | 'high' = 'none';
    if (totalStock === 0) priority = 'high';
    else if (totalStock < threshold) priority = 'medium';
    else if (totalStock < threshold * 1.5) priority = 'low';

    return { ...item, totalStock, priority };
  }).filter(item => item.priority !== 'none');

  const criticalStockCount = stockLevels.filter(s => s.priority === 'high' || s.priority === 'medium').length;

  // Process Expiration Alerts
  const now = new Date();
  const next30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  
  const expirationAlerts = (batches || []).map(batch => {
    const expDate = new Date(batch.expiration_date);
    let priority: 'none' | 'medium' | 'high' = 'none';

    if (expDate <= now) priority = 'high';
    else if (expDate <= next30Days) priority = 'medium';

    return { ...batch, priority };
  }).filter(b => b.priority !== 'none');

  return (
    <div className="dashboard-main" style={{ maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--navy)', margin: '0 0 0.25rem 0' }}>Panel de Control</h1>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Bienvenido de nuevo, {fullName}. Aquí tienes un resumen de la operación.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <Link href="/dashboard/inventario?view=entradas" className="btn-secondary" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Ingresar Stock
          </Link>
          <Link href="/dashboard/pedidos/nuevo" className="btn-primary" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nuevo Pedido
          </Link>
        </div>
      </div>

      {/* Main KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* KPI 1: Total Items */}
        <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', border: '1px solid var(--border)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: '600' }}>Productos Únicos</h3>
            <div style={{ padding: '0.5rem', borderRadius: '8px', background: '#eff6ff', color: '#3b82f6' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /></svg>
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--navy)', lineHeight: 1 }}>{items?.length || 0}</div>
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem', color: 'var(--success)', fontWeight: '600' }}>En catálogo maestro</p>
        </div>

        {/* KPI 2: Active Orders */}
        <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', border: '1px solid var(--border)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: '600' }}>Pedidos en Curso</h3>
            <div style={{ padding: '0.5rem', borderRadius: '8px', background: '#fef3c7', color: '#d97706' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--navy)', lineHeight: 1 }}>{activeOrders.length}</div>
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '500' }}>Pendientes de entrega</p>
        </div>

        {/* KPI 3: Lotes Aceptados */}
        <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', border: '1px solid var(--border)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: '600' }}>Lotes Aceptados</h3>
            <div style={{ padding: '0.5rem', borderRadius: '8px', background: '#dcfce7', color: '#166534' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--navy)', lineHeight: 1 }}>{batches?.filter((b: Batch) => b.clinical_status === 'accepted').length || 0}</div>
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem', color: 'var(--success)', fontWeight: '600' }}>Listos para uso clínico</p>
        </div>

        {/* KPI 4: Alertas */}
        <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', border: '1px solid var(--border)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: '600' }}>Alertas Críticas</h3>
            <div style={{ padding: '0.5rem', borderRadius: '8px', background: '#fee2e2', color: '#dc2626' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: criticalStockCount > 0 ? 'var(--error)' : 'var(--navy)', lineHeight: 1 }}>
            {criticalStockCount + expirationAlerts.filter(e => e.priority === 'high').length}
          </div>
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem', color: 'var(--error)', fontWeight: '600' }}>Stock/Vencimientos</p>
        </div>
      </div>

      {/* Detail Sections */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '1.5rem', alignItems: 'start' }}>
        
        {/* Left Column: Alerts & Orders */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Stock Alerts Card */}
          <div className="stat-card" style={{ padding: '0', overflow: 'hidden', flexDirection: 'column', alignItems: 'stretch' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FAFAFA' }}>
              <h2 style={{ fontSize: '1.1rem', color: 'var(--navy)', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--error)' }}></span>
                Productos con Stock Crítico
              </h2>
              <Link href="/dashboard/inventario" style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: '600', textDecoration: 'none' }}>Ver todo &rarr;</Link>
            </div>
            
            <div style={{ padding: '0' }}>
              {stockLevels.filter(s => s.priority === 'high' || s.priority === 'medium').length === 0 ? (
                <div style={{ padding: '3rem 2rem', textAlign: 'center' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto', color: '#166534' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <p style={{ color: 'var(--navy)', fontWeight: '600', margin: '0 0 0.25rem 0' }}>Estado Saludable</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>Todos los productos superan el mínimo establecido.</p>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <tbody>
                    {stockLevels
                      .filter(s => s.priority === 'high' || s.priority === 'medium')
                      .sort((a, b) => a.totalStock - b.totalStock)
                      .slice(0, 5) // Show top 5
                      .map((item, idx) => (
                      <tr key={item.id} style={{ borderBottom: idx !== 4 ? '1px solid var(--border)' : 'none' }}>
                        <td style={{ padding: '1rem 1.5rem' }}>
                          <div style={{ fontWeight: '600', color: 'var(--navy)', fontSize: '0.9rem' }}>{item.commercial_name || item.technical_name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Mínimo requerido: {item.minimum_stock_threshold} {item.purchase_unit}</div>
                        </td>
                        <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                          <div style={{ fontWeight: '700', fontSize: '1.1rem', color: item.priority === 'high' ? 'var(--error)' : 'var(--warning)' }}>
                            {item.totalStock} <span style={{ fontSize: '0.8rem', fontWeight: '500' }}>{item.usage_unit || item.purchase_unit}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Active Orders List */}
          <div className="stat-card" style={{ padding: '0', overflow: 'hidden', flexDirection: 'column', alignItems: 'stretch' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FAFAFA' }}>
              <h2 style={{ fontSize: '1.1rem', color: 'var(--navy)', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--warning)' }}></span>
                Pedidos Recientes (Pendientes)
              </h2>
              <Link href="/dashboard/pedidos" style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: '600', textDecoration: 'none' }}>Ver todo &rarr;</Link>
            </div>
            
            <div style={{ padding: '0' }}>
              {activeOrders.length === 0 ? (
                <div style={{ padding: '3rem 2rem', textAlign: 'center' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>No hay pedidos pendientes de entrega.</p>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead style={{ background: 'white', borderBottom: '1px solid var(--border)' }}>
                    <tr>
                      <th style={{ padding: '0.75rem 1.5rem', fontSize: '0.75rem', color: 'var(--navy-light)', textTransform: 'uppercase' }}>Pedido</th>
                      <th style={{ padding: '0.75rem 1.5rem', fontSize: '0.75rem', color: 'var(--navy-light)', textTransform: 'uppercase' }}>Proveedor</th>
                      <th style={{ padding: '0.75rem 1.5rem', fontSize: '0.75rem', color: 'var(--navy-light)', textTransform: 'uppercase', textAlign: 'right' }}>Estimado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeOrders.slice(0, 4).map((order, idx) => (
                      <tr key={order.id} style={{ borderBottom: idx !== Math.min(activeOrders.length, 4) - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer' }}>
                        <td style={{ padding: '1rem 1.5rem' }}>
                          <Link href={`/dashboard/pedidos/${order.id}`} style={{ fontWeight: '600', color: 'var(--primary)', fontSize: '0.9rem', textDecoration: 'none' }}>
                            {order.order_number}
                          </Link>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                            <span style={{ padding: '2px 6px', borderRadius: '8px', background: order.status === 'requested' ? '#dbeafe' : '#fef3c7', color: order.status === 'requested' ? '#1d4ed8' : '#d97706', fontSize: '0.65rem', fontWeight: 'bold', textTransform: 'uppercase' }}>
                              {order.status === 'requested' ? 'Solicitado' : 'Recibido Parcial'}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', fontWeight: '500' }}>
                          {order.supplier?.name}
                        </td>
                        <td style={{ padding: '1rem 1.5rem', textAlign: 'right', fontWeight: '600', color: 'var(--navy)', fontSize: '0.9rem' }}>
                          ${order.total_estimated_value?.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Expirations */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div className="stat-card" style={{ padding: '0', overflow: 'hidden', flexDirection: 'column', alignItems: 'stretch' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', background: '#FAFAFA' }}>
              <h2 style={{ fontSize: '1.1rem', color: 'var(--navy)', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--purple-dark)' }}></span>
                Próximos a Vencer
              </h2>
            </div>
            
            <div style={{ padding: '1rem 1.5rem' }}>
              {expirationAlerts.filter(e => e.priority === 'high' || e.priority === 'medium').length === 0 ? (
                <div style={{ padding: '2rem 1rem', textAlign: 'center' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>No hay lotes con riesgo de caducidad en los próximos 30 días.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {expirationAlerts
                    .filter(e => e.priority === 'high' || e.priority === 'medium')
                    .sort((a, b) => new Date(a.expiration_date).getTime() - new Date(b.expiration_date).getTime())
                    .slice(0, 6)
                    .map((batch: Batch) => {
                      const cStatus = batch.clinical_status || 'accepted';
                      return (
                        <div key={batch.id} style={{ display: 'flex', flexDirection: 'column', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                            <span style={{ fontWeight: '600', color: 'var(--navy)', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '60%' }}>
                              {(batch as { item?: { technical_name: string } }).item?.technical_name}
                            </span>
                            <span style={{ fontSize: '0.85rem', fontWeight: '700', color: batch.priority === 'high' ? 'var(--error)' : 'var(--warning)' }}>
                              {new Date(batch.expiration_date).toLocaleDateString()}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', alignItems: 'center' }}>
                            <span>Lote: {batch.batch_number}</span>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <span style={{ 
                                fontSize: '0.65rem', 
                                padding: '2px 6px', 
                                borderRadius: '4px', 
                                background: cStatus === 'accepted' ? '#dcfce7' : '#fef3c7',
                                color: cStatus === 'accepted' ? '#166534' : '#92400e',
                                fontWeight: '700',
                                textTransform: 'uppercase'
                              }}>
                                {cStatus === 'accepted' ? 'Aceptado' : 'Cuarentena'}
                              </span>
                              <span style={{ fontWeight: '600', color: 'var(--navy)' }}>Stock: {batch.current_stock}</span>
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

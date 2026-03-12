import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CatalogService } from "@/lib/services/catalog";
import { StockService } from "@/lib/services/stock";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    redirect("/login");
  }

  const user = authData.user;
  const fullName = user.user_metadata?.full_name || user.user_metadata?.name || "Usuario";
  const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture || null;
  
  // Fetch data for alerts
  const { data: items } = await CatalogService.getCatalogItems();
  const { data: batches } = await StockService.getAllBatches();
  const { data: suppliers } = await CatalogService.getSuppliers();

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

  // Process Expiration Alerts
  const now = new Date();
  const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const next30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const next90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const expirationAlerts = (batches || []).map(batch => {
    const expDate = new Date(batch.expiration_date);
    let priority: 'none' | 'low' | 'medium' | 'high' = 'none';

    if (expDate <= now || expDate <= next7Days) priority = 'high';
    else if (expDate <= next30Days) priority = 'medium';
    else if (expDate <= next90Days) priority = 'low';

    return { ...batch, priority };
  }).filter(b => b.priority !== 'none');

  return (
    <div className="dashboard-main">
      <div className="welcome-section">
        <div className="welcome-user-info">
          {avatarUrl ? (
            <img src={avatarUrl} alt={fullName} className="welcome-avatar" referrerPolicy="no-referrer" />
          ) : (
            <div className="welcome-avatar-fallback">
              {fullName.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h1>¡Bienvenido, {fullName}!</h1>
            <p>Panel de Control de Inventario Clínico</p>
          </div>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon stat-icon-blue">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /></svg>
          </div>
          <div className="stat-info">
            <h3>{items?.length || 0}</h3>
            <p>Productos en Catálogo</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon stat-icon-orange">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
          </div>
          <div className="stat-info">
            <h3>{suppliers?.length || 0}</h3>
            <p>Proveedores Registrados</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon stat-icon-red">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
          </div>
          <div className="stat-info">
            <h3>{stockLevels.filter(s => s.priority === 'high' || s.priority === 'medium').length}</h3>
            <p>Alertas de Stock</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon stat-icon-purple">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
          </div>
          <div className="stat-info">
            <h3>{expirationAlerts.filter(e => e.priority === 'high' || e.priority === 'medium').length}</h3>
            <p>Vencimientos Próximos</p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem', marginTop: '2rem' }}>
        {/* Stock Alerts Card */}
        <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'stretch', padding: '0' }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1rem', color: 'var(--navy)', fontWeight: 'bold' }}>Alertas de Stock Crítico</h2>
            <span style={{ fontSize: '0.75rem', background: 'var(--bg-app)', padding: '0.25rem 0.75rem', borderRadius: '12px', color: 'var(--text-muted)' }}>Mínimos de Seguridad</span>
          </div>
          <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {stockLevels.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>✅ Todos los productos tienen stock saludable.</p>
            ) : (
              stockLevels.sort((a, b) => (b.priority === 'high' ? 1 : 0) - (a.priority === 'high' ? 1 : 0)).map(item => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.priority === 'high' ? 'var(--error)' : item.priority === 'medium' ? 'var(--warning)' : '#FFD700' }}></div>
                    <div>
                      <h4 style={{ fontSize: '0.875rem', margin: '0' }}>{item.technical_name}</h4>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0' }}>Ref: {item.internal_code}</p>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 'bold', color: item.priority === 'high' ? 'var(--error)' : 'var(--navy)' }}>{item.totalStock}</span>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: '0' }}>Mín: {item.minimum_stock_threshold}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Expiration Alerts Card */}
        <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'stretch', padding: '0' }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1rem', color: 'var(--navy)', fontWeight: 'bold' }}>Vencimientos Próximos</h2>
            <span style={{ fontSize: '0.75rem', background: 'var(--bg-app)', padding: '0.25rem 0.75rem', borderRadius: '12px', color: 'var(--text-muted)' }}>Trazabilidad Lotes</span>
          </div>
          <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {expirationAlerts.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>✅ No hay lotes próximos a vencer.</p>
            ) : (
              expirationAlerts.map(batch => (
                <div key={batch.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: batch.priority === 'high' ? 'var(--error)' : batch.priority === 'medium' ? 'var(--warning)' : '#FFD700' }}></div>
                    <div>
                      <h4 style={{ fontSize: '0.875rem', margin: '0' }}>{(batch as any).item?.technical_name}</h4>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0' }}>Lote: {batch.batch_number}</p>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 'bold', color: batch.priority === 'high' ? 'var(--error)' : 'var(--navy)' }}>
                      {new Date(batch.expiration_date).toLocaleDateString()}
                    </span>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: '0' }}>Stock: {batch.current_stock}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

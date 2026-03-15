import { redirect } from "next/navigation";
import { CatalogService } from "@/lib/services/catalog";
import { StockService } from "@/lib/services/stock";
import { getCurrentUserProfile } from "@/lib/services/user";
import DeleteMasterButton from "@/components/DeleteMasterButton";
import InventoryProductSelector from "@/components/InventoryProductSelector";
import ExportCSVButton from "@/components/ExportCSVButton";
import RealtimeStockTable from "./RealtimeStockTable";
import { ContextHelp } from "@/components/ContextHelp";
import * as Actions from "./actions";
export const dynamic = "force-dynamic";

interface AuditUser {
  full_name: string | null;
  username: string | null;
}

interface Supplier {
  id: string;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  tax_id: string | null;
  is_active: boolean;
}

interface CatalogItem {
  id: string;
  internal_code: string;
  technical_name: string;
  commercial_name?: string | null;
  purchase_unit?: string | null;
  minimum_stock_threshold?: number | null;
  sections?: { name: string } | null;
  is_active?: boolean;
  sanitary_registration?: string | null;
}

interface Batch {
  id: string;
  item_id: string;
  batch_number: string;
  expiration_date: string;
  current_stock: number;
  location_id?: string | null;
  item?: CatalogItem | null;
  catalog_items?: CatalogItem | null;
  locations?: { name: string } | null;
  unit_cost?: number;
  clinical_status?: 'accepted' | 'quarantine' | 'rejected' | string;
}

interface StockMovement {
  id: string;
  movement_type: string;
  created_at: string;
  quantity: number;
  reason?: string | null;
  batch?: Batch | null;
  batches?: Batch | null;
  users?: AuditUser | AuditUser[] | null;
  equipment_name?: string | null;
  catalog_items?: CatalogItem | null;
  suppliers?: Supplier | null;
  purchase_order_id?: string | null;
  internal_order_id?: string | null;
}

function getUserDisplayName(users: AuditUser | AuditUser[] | null | undefined): string {
  if (!users) return 'Sistema';
  const user = Array.isArray(users) ? users[0] : users;
  return user?.full_name || user?.username || 'Sistema';
}

export default async function InventarioPage({
  searchParams,
}: {
  searchParams: Promise<{ editId?: string; view?: string; error?: string }>;
}) {
  const { editId, view, error } = await searchParams;
  const user = await getCurrentUserProfile();
  if (!user) {
    redirect("/auth/login");
  }

  // Initial data fetching
  const [
    { data: catalogItems },
    { data: sections },
    { data: suppliers },
    { data: locations },
    { data: allBatches },
    { data: allMovements }
  ] = await Promise.all([
    CatalogService.getCatalogItems(),
    CatalogService.getCategories(),
    CatalogService.getSections(),
    CatalogService.getSuppliers(),
    CatalogService.getLocations(),
    StockService.getAllBatches(),
    StockService.getAllMovements(),
  ]);

  const editingItem = editId ? catalogItems?.find(i => i.id === editId) : null;
  

  // Fetch latest batch if editing
  let latestBatch = null;
  if (editId) {
    try {
      const { data: batchData, error: batchError } = await StockService.getLatestBatchByItem(editId);
      latestBatch = batchData;
      if (batchError) console.error("Error fetching batch:", batchError);
    } catch (e) {
      console.error("Batch Fetch Exception:", e);
    }
  }

  // If no view is selected, we might want to show a default dashboard 
  // or redirect to 'entradas' if that's the primary use case.
  const currentView = view || "entradas";

  // Filter catalog items for the table to only show those with real entry history
  const productIdsWithStock = new Set(allBatches?.map((b: Batch) => b.item_id) || []);
  const catalogWithEntries = catalogItems?.filter((item: CatalogItem) => productIdsWithStock.has(item.id)) || [];

  // Compute consolidated stock for the 'stock' view
  const consolidatedStock = catalogItems?.map((item: CatalogItem) => {
    const itemBatches = allBatches?.filter((b: Batch) => b.item_id === item.id) || [];
    const totalStock = itemBatches.reduce((acc: number, b: Batch) => acc + (b.current_stock || 0), 0);
    return {
      ...item,
      itemBatches,
      totalStock
    };
  }).filter((item: CatalogItem & { totalStock: number, itemBatches: Batch[] }) => item.totalStock > 0 || (item.itemBatches && item.itemBatches.length > 0))
    .sort((a, b) => a.technical_name.localeCompare(b.technical_name)) || [];

  return (
    <div className="dashboard-main">
      <div className="welcome-section">
        <h1>Gestión de Inventario</h1>
        <p>Control de entradas, salidas y existencias del laboratorio.</p>
      </div>

      <div style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '1px' }}>
        <a 
          href="?view=entradas" 
          className={`tab-link ${currentView === 'entradas' ? 'active-tab' : ''}`}
        >
          Entrada de Productos
        </a>
        <a 
          href="?view=stock" 
          className={`tab-link ${currentView === 'stock' ? 'active-tab' : ''}`}
        >
          Stock Actual
        </a>
        <a 
          href="?view=salidas" 
          className={`tab-link ${currentView === 'salidas' ? 'active-tab' : ''}`}
        >
          Salida de Productos
        </a>
        <a 
          href="?view=movimientos" 
          className={`tab-link ${currentView === 'movimientos' ? 'active-tab' : ''}`}
        >
          Kardex (Historial)
        </a>
      </div>

      <div className="config-content">
        {error && (
          <div style={{ padding: '1rem', marginBottom: '1.5rem', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '10px', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem' }}>
            <span style={{ fontSize: '1.25rem' }}>⚠️</span>
            <div>
              <strong>Error al guardar:</strong> {decodeURIComponent(error)}
            </div>
            <a href="?view=entradas" style={{ marginLeft: 'auto', color: '#991b1b', textDecoration: 'none', fontWeight: 'bold' }}>✕</a>
          </div>
        )}
        {currentView === 'entradas' && (
          <>
            <div className="welcome-section" style={{ padding: '0.5rem 1rem 1.5rem 1rem' }}>
              <h2 style={{ fontSize: '1.125rem', color: 'var(--navy)', fontWeight: '800' }}>Catálogo Maestro de Productos</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Defina los productos maestros que ingresarán al inventario.</p>
            </div>

            {/* Registration Form */}
            <div className="stat-card" style={{ width: '100%', flexDirection: 'column', alignItems: 'stretch', marginBottom: '2rem' }}>
              <div style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
                <h2 style={{ fontSize: '1.25rem', color: 'var(--navy)' }}>
                  {editingItem ? "Editar Producto" : "Nuevo Registro en Catálogo"}
                </h2>
                {editingItem && (
                  <a href="?view=entradas" style={{ fontSize: '0.875rem', color: 'var(--error)', textDecoration: 'none' }}>
                    Cancelar Edición
                  </a>
                )}
              </div>
              
              <InventoryProductSelector 
                products={catalogItems || []} 
                currentId={editId}
              />

              <form key={editId || 'new'} action={Actions.handleCatalogAction} style={{ padding: '2rem' }}>
                <input type="hidden" name="id" value={editingItem?.id || ""} />
                
                <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                  {/* Master Data / Technical Specs (ReadOnly if editing) */}
                  <div className="form-section" style={{ background: editingItem ? 'rgba(var(--primary-rgb), 0.03)' : 'transparent', padding: '1.5rem', borderRadius: '12px', border: editingItem ? '1px dashed var(--primary)' : '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                      <h3 style={{ fontSize: '0.875rem', color: 'var(--primary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {editingItem ? "📄 Ficha Técnica (Maestro)" : "Información Básica"}
                      </h3>
                      {editingItem && <span style={{ fontSize: '0.65rem', background: 'var(--primary)', color: 'white', padding: '2px 8px', borderRadius: '10px' }}>Solo Lectura</span>}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2.5fr', gap: '1rem' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.5rem', color: 'var(--navy-light)' }}>Código / REF</label>
                          <input 
                            name="internal_code" 
                            defaultValue={editingItem?.internal_code || ""} 
                            required 
                            readOnly={!!editingItem}
                            style={{ 
                              width: '100%', 
                              padding: '0.75rem', 
                              borderRadius: '8px', 
                              border: '1px solid var(--border)',
                              background: editingItem ? 'var(--bg-app)' : 'white',
                              cursor: editingItem ? 'not-allowed' : 'text',
                              fontWeight: editingItem ? '600' : 'normal'
                            }} 
                            placeholder="REF-001" 
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.5rem', color: 'var(--navy-light)' }}>Nombre Técnico</label>
                          <input 
                            name="technical_name" 
                            defaultValue={editingItem?.technical_name || ""} 
                            required 
                            readOnly={!!editingItem}
                            style={{ 
                              width: '100%', 
                              padding: '0.75rem', 
                              borderRadius: '8px', 
                              border: '1px solid var(--border)',
                              background: editingItem ? 'var(--bg-app)' : 'white',
                              cursor: editingItem ? 'not-allowed' : 'text',
                              fontWeight: editingItem ? '600' : 'normal'
                            }} 
                            placeholder="Ej: Glucosa Oxidasa" 
                          />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '1rem' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.5rem', color: 'var(--navy-light)' }}>Presentación / Comercial</label>
                          <input 
                            name="commercial_name" 
                            defaultValue={editingItem?.commercial_name || ""} 
                            readOnly={!!editingItem}
                            style={{ 
                              width: '100%', 
                              padding: '0.75rem', 
                              borderRadius: '8px', 
                              border: '1px solid var(--border)',
                              background: editingItem ? 'var(--bg-app)' : 'white',
                              cursor: editingItem ? 'not-allowed' : 'text'
                            }} 
                            placeholder="Ej: Kit KIT01" 
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.5rem', color: 'var(--navy-light)' }}>Registro Sanitario / INVIMA</label>
                          <input 
                            name="sanitary_registration" 
                            defaultValue={editingItem?.sanitary_registration || ""}
                            placeholder="Ej: INVIMA 2024RD-..."
                            style={{ 
                              width: '100%', 
                              padding: '0.75rem', 
                              borderRadius: '8px', 
                              border: '1px solid var(--border)',
                            }} 
                          />
                        </div>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.5rem', color: 'var(--navy-light)' }}>Categoría / Clasificación</label>
                        {editingItem ? (
                          <div style={{ padding: '0.75rem', background: 'var(--bg-app)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.875rem', fontWeight: '600' }}>
                            {sections?.find(s => s.id === editingItem.section_id)?.name || "Sin Categoría"}
                            <input type="hidden" name="section_id" value={editingItem.section_id || ""} />
                          </div>
                        ) : (
                          <select name="section_id" required style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                            <option value="">Seleccione Categoría...</option>
                            {sections?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Operational Data / Stock Entry */}
                  <div className="form-section" style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                      <h3 style={{ fontSize: '0.875rem', color: 'var(--primary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        📥 Registro de Compra / Entrada
                      </h3>
                      <ContextHelp 
                        title="Ingreso de Stock" 
                        content="Registra nuevos lotes adquiridos. El sistema aplicará automáticamente la política FEFO (First Expired, First Out) basa en la fecha de vencimiento que ingreses." 
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.5rem', color: 'var(--navy-light)' }}>Proveedor Habitual *</label>
                          <select 
                            name="supplier_id" 
                            defaultValue={latestBatch?.supplier_id || editingItem?.supplier_id || ""} 
                            required 
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                          >
                            <option value="">Seleccione Proveedor...</option>
                            {suppliers?.map(sup => <option key={sup.id} value={sup.id}>{sup.name}</option>)}
                          </select>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.5rem', color: 'var(--navy-light)' }}>Lote / Batch *</label>
                          <input 
                            name="batch_number" 
                            defaultValue={latestBatch?.batch_number || ""} 
                            required 
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }} 
                            placeholder="Ej: LOT-2024-001" 
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.5rem', color: 'var(--navy-light)' }}>Fecha de Vencimiento *</label>
                          <input 
                            type="date" 
                            name="expiration_date" 
                            defaultValue={latestBatch?.expiration_date ? new Date(latestBatch.expiration_date).toISOString().split('T')[0] : ""} 
                            required 
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }} 
                          />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.5rem', color: 'var(--navy-light)' }}>Cantidad (Total Unidades) *</label>
                          <input type="number" name="quantity" defaultValue="1" min="1" required style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.5rem', color: 'var(--navy-light)' }}>Ubicación de Almacenamiento *</label>
                          <select name="location_id" defaultValue={latestBatch?.location_id || ""} required style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                            <option value="">Seleccione Ubicación...</option>
                            {locations?.map(loc => <option key={loc.id} value={loc.id}>{loc.name} ({loc.location_type})</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
                  <button 
                    type="submit" 
                    style={{ 
                      padding: '0.875rem 2.5rem', 
                      background: editingItem ? 'var(--warning)' : 'var(--primary)', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: '8px', 
                      fontWeight: '700',
                      cursor: 'pointer',
                      boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                    }}
                  >
                    {editingItem ? "Actualizar Producto" : "Registrar Producto"}
                  </button>
                </div>
              </form>
            </div>

            {/* Catalog Table */}
            <div className="stat-card" style={{ width: '100%', flexDirection: 'column', alignItems: 'stretch' }}>
              <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)' }}>
                <h2 style={{ fontSize: '1.25rem', color: 'var(--navy)' }}>Catálogo Vigente</h2>
              </div>
              <div className="table-responsive">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
                      <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem' }}>Código</th>
                      <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem' }}>Nombre del Producto</th>
                      <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem' }}>Categoría / Sub</th>
                      <th style={{ padding: '1.25rem' }}>Presentación</th>
                      <th style={{ padding: '1.25rem' }}>Mín. Stock</th>
                      <th style={{ padding: '1.25rem' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catalogWithEntries?.map((i: CatalogItem) => (
                      <tr key={i.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}>
                        <td style={{ padding: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{i.internal_code}</td>
                        <td style={{ padding: '1rem' }}>
                          <div style={{ fontWeight: '700', color: 'var(--navy)' }}>{i.technical_name}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{i.commercial_name}</div>
                        </td>
                        <td style={{ padding: '1.25rem' }}>
                          <div style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: '600' }}>{i.sections?.name}</div>
                        </td>
                        <td style={{ padding: '1.25rem', fontSize: '0.9rem' }}>{i.purchase_unit}</td>
                        <td style={{ padding: '1.25rem', fontWeight: '700' }}>{i.minimum_stock_threshold}</td>
                        <td style={{ padding: '1.25rem' }}>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <a href={`?view=entradas&editId=${i.id}`} style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', border: '1px solid var(--border)', borderRadius: '6px', textDecoration: 'none', color: 'var(--navy)', background: 'white' }}>Editar</a>
                            <form action={Actions.toggleStatus.bind(null, i.id, !!i.is_active)}>
                              <button type="submit" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', color: i.is_active ? 'var(--error)' : 'var(--success)', cursor: 'pointer' }}>
                                {i.is_active ? 'Inactivar' : 'Activar'}
                              </button>
                            </form>
                            <DeleteMasterButton 
                              onDelete={Actions.handleDelete.bind(null, i.id)} 
                              confirmMessage={`¿Seguro quieres eliminar "${i.technical_name}" del catálogo?`}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                    {(!catalogWithEntries || catalogWithEntries.length === 0) && (
                      <tr>
                        <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                          No hay productos registrados en el catálogo aún.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {currentView === 'stock' && (
          <div className="stat-card" style={{ width: '100%', flexDirection: 'column', alignItems: 'stretch' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', color: 'var(--navy)' }}>Stock Actual Consolidado</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Visión global y en tiempo real de las existencias disponibles por producto.</p>
              </div>
              <ExportCSVButton 
                filename="Reporte_Stock_Actual" 
                data={consolidatedStock.map((row: CatalogItem & { totalStock: number, itemBatches: Batch[] }) => ({
                  'Código': row.internal_code || 'N/A',
                  'Producto': row.technical_name || 'N/A',
                  'Nombre Comercial': row.commercial_name || 'N/A',
                  'Categoría': row.sections?.name || 'Genérico',
                  'Stock Total Universitario': row.totalStock,
                  'Unidad de Compra': row.purchase_unit || 'N/A',
                  'Lotes Disponibles (Lote:Cantidad)': row.itemBatches?.filter((b: Batch) => b.current_stock > 0).map((b: Batch) => `${b.batch_number}:${b.current_stock}`).join(' | ') || 'Agotado',
                  'Estado de Inventario': row.totalStock === 0 ? 'Agotado' : row.totalStock <= (row.minimum_stock_threshold || 10) ? 'Stock Bajo' : 'Óptimo'
                }))}
              />
            </div>
            <RealtimeStockTable initialBatches={allBatches || []} />
          </div>
        )}

        {currentView === 'salidas' && (
          <div className="stat-card" style={{ width: '100%', flexDirection: 'column', alignItems: 'stretch' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', color: 'var(--navy)', margin: 0 }}>Registrar Salida / Consumo</h2>
                <ContextHelp 
                  title="Consumo de Reactivos" 
                  content="Selecciona el lote a utilizar. Por seguridad clínica, el sistema solo permite consumir lotes con estado 'Aceptado'. El lote sugerido es siempre el más próximo a vencer." 
                />
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Descuente stock del inventario para uso operativo o ajustes.</p>
            </div>
            
            <form action={Actions.handleConsumeAction} style={{ padding: '2rem' }}>
              <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 600px)', gap: '1.5rem', justifyContent: 'center' }}>
                <div className="form-section" style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.5rem', color: 'var(--navy-light)' }}>Producto / Lote a Consumir *</label>
                      <select name="batch_id" required style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                        <option value="">Seleccione Lote (Sugiere el más próximo a vencer)...</option>
                        {allBatches
                          ?.filter((b: Batch) => b.current_stock > 0 && b.clinical_status === 'accepted')
                          .sort((a, b) => new Date(a.expiration_date).getTime() - new Date(b.expiration_date).getTime())
                          .map((b: Batch, idx) => (
                          <option key={b.id} value={b.id}>
                            {idx === 0 ? "👉 SUGERIDO (FEFO): " : ""}{b.item?.technical_name} (Lote: {b.batch_number}) - Vence: {new Date(b.expiration_date).toLocaleDateString()} - Disp: {b.current_stock}
                          </option>
                        ))}
                        <optgroup label="⚠️ Otros Lotes (No Aceptados / Cuarentena)">
                          {allBatches
                            ?.filter((b: Batch) => b.current_stock > 0 && b.clinical_status !== 'accepted')
                            .map((b: Batch) => (
                            <option key={b.id} value={b.id} disabled>
                              BLOQUEADO: {b.item?.technical_name} (Lote: {b.batch_number}) - Estado: {b.clinical_status}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.5rem', color: 'var(--navy-light)' }}>Cantidad a Descontar *</label>
                        <input type="number" name="quantity" defaultValue="1" min="1" required style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.5rem', color: 'var(--navy-light)' }}>Motivo / Justificación *</label>
                        <select name="reason" required style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                          <option value="Consumo operativo">Consumo Operativo</option>
                          <option value="Descarte por vencimiento">Descarte por Vencimiento</option>
                          <option value="Ajuste por pérdida">Ajuste por Pérdida/Daño</option>
                          <option value="Calibración/Control">Uso en Calibración/Control</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.5rem', color: 'var(--navy-light)' }}>Analizador / Equipo Destino (Opcional - ISO 15189)</label>
                      <input 
                        name="equipment" 
                        placeholder="Ej: Cobas c311, Sysmex XN-1000..." 
                        style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }} 
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
                <button 
                  type="submit" 
                  style={{ 
                    padding: '0.875rem 2.5rem', 
                    background: 'var(--error)', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '8px', 
                    fontWeight: '700',
                    cursor: 'pointer',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                  }}
                >
                  Registrar Salida
                </button>
              </div>
            </form>
          </div>
        )}

        {currentView === 'movimientos' && (
          <div className="stat-card" style={{ width: '100%', flexDirection: 'column', alignItems: 'stretch' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', color: 'var(--navy)' }}>Kardex (Historial de Movimientos)</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Registro auditable de todas las entradas, salidas y ajustes de inventario.</p>
              </div>
              <ExportCSVButton 
                filename="Kardex_Movimientos" 
                data={(allMovements || []).map((row: StockMovement) => ({
                  'Fecha Realización': new Date(row.created_at).toLocaleString(),
                  'Tipo Movimiento': row.movement_type === 'entry' ? 'Entrada' : row.movement_type === 'exit' ? 'Salida' : row.movement_type === 'adjustment' ? 'Ajuste' : 'Descarte',
                  'Producto': row.batch?.item?.technical_name || 'Desconocido',
                  'Código Interno': row.batch?.item?.internal_code || 'N/A',
                  'Número de Lote': row.batch?.batch_number || 'N/A',
                  'Fecha Vencimiento': row.batch?.expiration_date ? new Date(row.batch.expiration_date).toLocaleDateString() : 'N/A',
                  'Impacto en Stock': (row.movement_type === 'entry' ? '+' : '-') + (row.quantity || 0),
                  'Responsable': getUserDisplayName(row.users),
                  'Motivo / Justificación': row.reason || null
                }))} 
              />
            </div>
            <div className="table-responsive">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
                    <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem' }}>Fecha y Hora</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem' }}>Tipo</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem' }}>Producto</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem' }}>Lote / Vencimiento</th>
                    <th style={{ padding: '1rem', textAlign: 'center', fontSize: '0.75rem' }}>Cantidad</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem' }}>Usuario / Notas</th>
                    <th style={{ padding: '1rem', textAlign: 'center', fontSize: '0.75rem' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {allMovements?.map((m: StockMovement) => (
                    <tr key={m.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}>
                      <td style={{ padding: '1rem', fontSize: '0.85rem' }}>
                        {new Date(m.created_at).toLocaleDateString()}
                        <br/><span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{new Date(m.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ 
                          padding: '0.25rem 0.6rem', 
                          borderRadius: '12px', 
                          fontSize: '0.75rem', 
                          fontWeight: '700',
                          background: m.movement_type === 'entry' ? '#dcfce7' : m.movement_type === 'exit' ? '#fee2e2' : '#fef9c3',
                          color: m.movement_type === 'entry' ? '#166534' : m.movement_type === 'exit' ? '#991b1b' : '#854d0e',
                          textTransform: 'uppercase'
                        }}>
                          {m.movement_type === 'entry' ? 'Entrada' : m.movement_type === 'exit' ? 'Salida' : m.movement_type === 'adjustment' ? 'Ajuste' : 'Descarte'}
                        </span>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ fontWeight: '700', color: 'var(--navy)', fontSize: '0.85rem' }}>{m.batch?.item?.technical_name || 'Desconocido'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{m.batch?.item?.internal_code || 'N/A'}</div>
                      </td>
                      <td style={{ padding: '1rem', fontSize: '0.85rem' }}>
                        <div style={{ fontWeight: '600' }}>{m.batch?.batch_number}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--error)' }}>
                          Vence: {m.batch && 'expiration_date' in m.batch && m.batch.expiration_date ? new Date(m.batch.expiration_date).toLocaleDateString() : 'N/A'}
                        </div>
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center', fontWeight: '800', fontSize: '1rem', color: m.movement_type === 'entry' ? 'var(--success)' : m.movement_type === 'adjustment' ? 'var(--warning)' : 'var(--error)' }}>
                        {m.movement_type === 'entry' ? '+' : '-'}{m.quantity}
                      </td>
                      <td style={{ padding: '1rem', fontSize: '0.85rem' }}>
                        <div style={{ fontWeight: '600' }}>{getUserDisplayName(m.users)}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{m.reason}</span>
                          {m.equipment_name && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: '700' }}>🔬 Equipo: {m.equipment_name}</span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        {m.batch?.id && (
                          <a 
                            href={`/dashboard/seguridad/reportar/${m.batch.id}`} 
                            title="Reportar Incidente de Calidad / Recall"
                            style={{ 
                              display: 'inline-flex', 
                              padding: '0.4rem', 
                              background: '#fff1f2', 
                              color: '#e11d48', 
                              borderRadius: '6px', 
                              border: '1px solid #fda4af',
                              transition: 'all 0.2s'
                            }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                  {(!allMovements || allMovements.length === 0) && (
                    <tr>
                      <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No hay movimientos registrados en el historial.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .tab-link {
          text-decoration: none;
          color: var(--navy-light);
          font-weight: 700;
          font-size: 0.9375rem;
          padding: 0.75rem 1.5rem;
          border-radius: 8px 8px 0 0;
          transition: all 0.2s;
          border-bottom: 2px solid transparent;
        }
        .tab-link:hover { color: var(--primary); }
        .active-tab { 
          color: var(--primary); 
          border-bottom: 2px solid var(--primary);
          background: var(--bg-app);
        }
      `}} />
    </div>
  );
}

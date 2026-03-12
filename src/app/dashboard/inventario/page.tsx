import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CatalogService } from "@/lib/services/catalog";
import { StockService } from "@/lib/services/stock";
import { revalidatePath } from "next/cache";
import DeleteMasterButton from "@/components/DeleteMasterButton";
import InventoryProductSelector from "@/components/InventoryProductSelector";
import * as Actions from "./actions";
export const dynamic = "force-dynamic";

export default async function InventarioPage({
  searchParams,
}: {
  searchParams: Promise<{ editId?: string; view?: string; error?: string }>;
}) {
  const { editId, view, error } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Initial data fetching
  const [
    { data: catalogItems },
    { data: categories },
    { data: sections },
    { data: suppliers },
    { data: locations },
    { data: allBatches }
  ] = await Promise.all([
    CatalogService.getCatalogItems(),
    CatalogService.getCategories(),
    CatalogService.getSections(),
    CatalogService.getSuppliers(),
    CatalogService.getLocations(),
    StockService.getAllBatches(),
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
  const productIdsWithStock = new Set(allBatches?.map(b => b.item_id) || []);
  const catalogWithEntries = catalogItems?.filter(item => productIdsWithStock.has(item.id)) || [];

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
                    <h3 style={{ fontSize: '0.875rem', color: 'var(--primary)', marginBottom: '1.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      📥 Registro de Compra / Entrada
                    </h3>
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
                    {catalogWithEntries?.map(i => (
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
          <div className="stat-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <h2 style={{ color: 'var(--navy)', marginBottom: '1rem' }}>Stock Actual</h2>
            <p>Módulo de visualización de existencias en tiempo real (Próximamente).</p>
          </div>
        )}

        {currentView === 'salidas' && (
          <div className="stat-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <h2 style={{ color: 'var(--navy)', marginBottom: '1rem' }}>Salida de Productos</h2>
            <p>Módulo de registro de consumos y ajustes de inventario (Próximamente).</p>
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

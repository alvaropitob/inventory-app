import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/services/user";
import { CatalogService } from "@/lib/services/catalog";
import { revalidatePath } from "next/cache";
import DeleteMasterButton from "@/components/DeleteMasterButton";
import * as Actions from "./actions";

export const dynamic = "force-dynamic";

export default async function ConfiguracionPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; editId?: string }>;
}) {
  const { tab, editId } = await searchParams;
  const user = await getCurrentUserProfile();

  if (!user || user.role !== "admin") {
    redirect("/dashboard");
  }

  const activeTab = tab || "secciones";

  // Data fetching based on active tab
  const [{ data: sections }, { data: suppliers }, { data: categories }, { data: locations }, { data: catalogItems }] = await Promise.all([
    CatalogService.getSections(),
    CatalogService.getSuppliers(),
    CatalogService.getCategories(),
    CatalogService.getLocations(),
    CatalogService.getCatalogItems(),
  ]);

  // Find item to edit if editId is present
  const editingItem = editId ? (
    activeTab === "secciones" ? sections?.find(s => s.id === editId) :
      activeTab === "proveedores" ? suppliers?.find(s => s.id === editId) :
        activeTab === "categorias" ? categories?.find(c => c.id === editId) :
          activeTab === "ubicaciones" ? locations?.find(l => l.id === editId) :
            activeTab === "productos" ? catalogItems?.find(i => i.id === editId) :
              null
  ) : null;

  // Server Actions are now imported from ./actions.ts

  return (
    <div className="dashboard-main">
      <div className="welcome-section">
        <h1>Configuración de Maestros</h1>
        <p>Gestiona los pilares estructurales del laboratorio clínico.</p>
      </div>

      <div className="tabs-container" style={{
        display: 'flex',
        gap: '0.5rem',
        marginBottom: '2rem',
        borderBottom: '1px solid var(--border)',
        paddingBottom: '0.5rem',
        overflowX: 'auto',
        whiteSpace: 'nowrap',
        WebkitOverflowScrolling: 'touch'
      }}>
        <a href="?tab=categorias" className={`tab-link ${activeTab === 'categorias' ? 'active-tab' : ''}`}>Categorias Maestras</a>
        <a href="?tab=secciones" className={`tab-link ${activeTab === 'secciones' ? 'active-tab' : ''}`}>Categorías Inventario</a>
        <a href="?tab=proveedores" className={`tab-link ${activeTab === 'proveedores' ? 'active-tab' : ''}`}>Proveedores</a>
        <a href="?tab=productos" className={`tab-link ${activeTab === 'productos' ? 'active-tab' : ''}`}>Productos</a>
        <a href="?tab=ubicaciones" className={`tab-link ${activeTab === 'ubicaciones' ? 'active-tab' : ''}`}>Ubicaciones de Almacenamiento</a>
      </div>

      <div className="config-content">
        {activeTab === "secciones" && (
          <div className="stat-card" style={{ width: '100%', flexDirection: 'column', alignItems: 'stretch' }}>
            <div style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>{editingItem ? "Editar Categoría de Inventario" : "Categorías de Inventario"}</h2>
              {editingItem && <a href="?tab=secciones" style={{ fontSize: '0.875rem', color: 'var(--error)' }}>Cancelar Edición</a>}
            </div>
            <form action={Actions.handleSectionAction} className="responsive-grid" style={{ padding: '1.5rem', background: 'var(--bg-app)', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '1rem', alignItems: 'end' }}>
              <input type="hidden" name="id" value={editingItem?.id || ""} />
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Nombre de Subcategoría</label>
                <input name="name" defaultValue={editingItem?.name || ""} required style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }} placeholder="Ej: Hematología" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Categoría Padre</label>
                <select name="category_id" defaultValue={(editingItem as any)?.category_id || ""} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <option value="">(Ninguna)</option>
                  {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Descripción</label>
                <input name="description" defaultValue={editingItem?.description || ""} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }} placeholder="Breve descripción..." />
              </div>
              <button type="submit" style={{ padding: '0.75rem 1.5rem', background: editingItem ? 'var(--warning)' : 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                {editingItem ? "Actualizar" : "Añadir"}
              </button>
            </form>
            <div className="table-responsive">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '1rem' }}>Nombre</th>
                    <th style={{ padding: '1rem' }}>Descripción</th>
                    <th style={{ padding: '1rem' }}>Estado</th>
                    <th style={{ padding: '1rem' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {sections?.map(s => (
                    <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '1rem', fontWeight: 'bold' }}>{s.name}</td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--primary)' }}>
                          {(s as any).categories?.name || '---'}
                        </span>
                      </td>
                      <td style={{ padding: '1rem' }}>{s.description}</td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.7rem', background: s.is_active ? '#dcfce7' : '#fee2e2', color: s.is_active ? '#10b981' : '#ef4444' }}>
                          {s.is_active ? 'ACTIVO' : 'INACTIVO'}
                        </span>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <a href={`?tab=secciones&editId=${s.id}`} style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', border: '1px solid var(--border)', borderRadius: '6px', textDecoration: 'none', color: 'var(--navy)' }}>Editar</a>
                          <form action={Actions.toggleStatus.bind(null, s.id, !!s.is_active, 'section')}>
                            <button type="submit" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', color: s.is_active ? 'var(--error)' : 'var(--success)', cursor: 'pointer' }}>
                              {s.is_active ? 'Inactivar' : 'Activar'}
                            </button>
                          </form>
                          <DeleteMasterButton
                            onDelete={Actions.handleDelete.bind(null, s.id, 'section')}
                            confirmMessage={`¿Seguro quieres eliminar la categoría "${s.name}"?`}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "proveedores" && (
          <div className="stat-card" style={{ width: '100%', flexDirection: 'column', alignItems: 'stretch' }}>
            <div style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>{editingItem ? "Editar Proveedor" : "Registro de Proveedores"}</h2>
              {editingItem && <a href="?tab=proveedores" style={{ fontSize: '0.875rem', color: 'var(--error)' }}>Cancelar Edición</a>}
            </div>
            <form action={Actions.handleSupplierAction} className="responsive-grid" style={{ padding: '1.5rem', background: 'var(--bg-app)', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: '1rem', alignItems: 'end' }}>
              <input type="hidden" name="id" value={editingItem?.id || ""} />
              <input name="name" defaultValue={editingItem?.name || ""} placeholder="Empresa" required style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }} />
              <input name="contact_name" defaultValue={(editingItem as any)?.contact_name || ""} placeholder="Contacto" style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }} />
              <input name="contact_email" defaultValue={(editingItem as any)?.contact_email || ""} placeholder="Email" style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }} />
              <input name="tax_id" defaultValue={(editingItem as any)?.tax_id || ""} placeholder="NIT/Tax ID" style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }} />
              <button type="submit" style={{ padding: '0.75rem 1.5rem', background: editingItem ? 'var(--warning)' : 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>
                {editingItem ? "Actualizar" : "Añadir"}
              </button>
            </form>
            <div className="table-responsive">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '1rem' }}>Empresa</th>
                    <th style={{ padding: '1rem' }}>Contacto</th>
                    <th style={{ padding: '1rem' }}>Estado</th>
                    <th style={{ padding: '1rem' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers?.map(sup => (
                    <tr key={sup.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '1rem', fontWeight: 'bold' }}>{sup.name}</td>
                      <td style={{ padding: '1rem' }}>
                        <div>{sup.contact_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{sup.contact_email}</div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.7rem', background: sup.is_active ? '#dcfce7' : '#fee2e2', color: sup.is_active ? '#10b981' : '#ef4444' }}>
                          {sup.is_active ? 'ACTIVO' : 'INACTIVO'}
                        </span>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <a href={`?tab=proveedores&editId=${sup.id}`} style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', border: '1px solid var(--border)', borderRadius: '6px', textDecoration: 'none', color: 'var(--navy)' }}>Editar</a>
                          <form action={Actions.toggleStatus.bind(null, sup.id, !!sup.is_active, 'supplier')}>
                            <button type="submit" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', color: sup.is_active ? 'var(--error)' : 'var(--success)', cursor: 'pointer' }}>
                              {sup.is_active ? 'Inactivar' : 'Activar'}
                            </button>
                          </form>
                          <DeleteMasterButton
                            onDelete={Actions.handleDelete.bind(null, sup.id, 'supplier')}
                            confirmMessage={`¿Seguro quieres eliminar al proveedor "${sup.name}"?`}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "categorias" && (
          <div className="stat-card" style={{ width: '100%', flexDirection: 'column', alignItems: 'stretch' }}>
            <div style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>{editingItem ? "Editar Categoría Maestra" : "Categorías Maestras (Nivel Superior)"}</h2>
              {editingItem && <a href="?tab=categorias" style={{ fontSize: '0.875rem', color: 'var(--error)' }}>Cancelar Edición</a>}
            </div>
            <form action={Actions.handleCategoryAction} className="responsive-grid" style={{ padding: '1.5rem', background: 'var(--bg-app)', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '1rem', alignItems: 'end' }}>
              <input type="hidden" name="id" value={editingItem?.id || ""} />
              <input name="name" defaultValue={editingItem?.name || ""} placeholder="Nombre" required style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }} />
              <input name="description" defaultValue={editingItem?.description || ""} placeholder="Descripción" style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }} />
              <button type="submit" style={{ padding: '0.75rem 1.5rem', background: editingItem ? 'var(--warning)' : 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>
                {editingItem ? "Actualizar" : "Añadir"}
              </button>
            </form>
            <div className="table-responsive">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '1rem' }}>Nombre</th>
                    <th style={{ padding: '1rem' }}>Descripción</th>
                    <th style={{ padding: '1rem' }}>Estado</th>
                    <th style={{ padding: '1rem' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {categories?.map(c => (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '1rem', fontWeight: 'bold' }}>{c.name}</td>
                      <td style={{ padding: '1rem' }}>{c.description}</td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.7rem', background: c.is_active ? '#dcfce7' : '#fee2e2', color: c.is_active ? '#10b981' : '#ef4444' }}>
                          {c.is_active ? 'ACTIVO' : 'INACTIVO'}
                        </span>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <a href={`?tab=categorias&editId=${c.id}`} style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', border: '1px solid var(--border)', borderRadius: '6px', textDecoration: 'none', color: 'var(--navy)' }}>Editar</a>
                          <form action={Actions.toggleStatus.bind(null, c.id, !!c.is_active, 'category')}>
                            <button type="submit" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', color: c.is_active ? 'var(--error)' : 'var(--success)', cursor: 'pointer' }}>
                              {c.is_active ? 'Inactivar' : 'Activar'}
                            </button>
                          </form>
                          <DeleteMasterButton
                            onDelete={Actions.handleDelete.bind(null, c.id, 'category')}
                            confirmMessage={`¿Seguro quieres eliminar la categoría "${c.name}"?`}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "ubicaciones" && (
          <div className="stat-card" style={{ width: '100%', flexDirection: 'column', alignItems: 'stretch' }}>
            <div style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>{editingItem ? "Editar Ubicación" : "Ubicaciones de Almacenamiento"}</h2>
              {editingItem && <a href="?tab=ubicaciones" style={{ fontSize: '0.875rem', color: 'var(--error)' }}>Cancelar Edición</a>}
            </div>
            <form action={Actions.handleLocationAction} className="responsive-grid" style={{ padding: '1.5rem', background: 'var(--bg-app)', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'end' }}>
              <input type="hidden" name="id" value={editingItem?.id || ""} />
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Nombre de Ubicación *</label>
                <input name="name" defaultValue={editingItem?.name || ""} placeholder="Nombre (ej: Nevera A1)" required style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Categoría / Sección *</label>
                <select name="section_id" defaultValue={(editingItem as any)?.section_id || ""} required style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <option value="">Seleccione Categoría...</option>
                  {sections?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Tipo de Ubicación</label>
                <select name="location_type" defaultValue={(editingItem as any)?.location_type || "shelf"} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <option value="shelf">Estantería</option>
                  <option value="refrigerator">Nevera</option>
                  <option value="freezer">Congelador</option>
                </select>
              </div>
              <button type="submit" style={{ padding: '0.75rem 1.5rem', background: editingItem ? 'var(--warning)' : 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                {editingItem ? "Actualizar" : "Añadir"}
              </button>
            </form>
            <div className="table-responsive">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '1rem' }}>Nombre</th>
                    <th style={{ padding: '1rem' }}>Categoría de Inventario</th>
                    <th style={{ padding: '1rem' }}>Estado</th>
                    <th style={{ padding: '1rem' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {locations?.map(l => (
                    <tr key={l.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '1rem', fontWeight: 'bold' }}>{l.name}</td>
                      <td style={{ padding: '1rem' }}>{(l as any).sections?.name}</td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.7rem', background: l.is_active ? '#dcfce7' : '#fee2e2', color: l.is_active ? '#10b981' : '#ef4444' }}>
                          {l.is_active ? 'ACTIVO' : 'INACTIVO'}
                        </span>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <a href={`?tab=ubicaciones&editId=${l.id}`} style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', border: '1px solid var(--border)', borderRadius: '6px', textDecoration: 'none', color: 'var(--navy)' }}>Editar</a>
                          <form action={Actions.toggleStatus.bind(null, l.id, !!l.is_active, 'location')}>
                            <button type="submit" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', color: l.is_active ? 'var(--error)' : 'var(--success)', cursor: 'pointer' }}>
                              {l.is_active ? 'Inactivar' : 'Activar'}
                            </button>
                          </form>
                          <DeleteMasterButton
                            onDelete={Actions.handleDelete.bind(null, l.id, 'location')}
                            confirmMessage={`¿Seguro quieres eliminar la ubicación "${l.name}"?`}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "productos" && (
          <div className="stat-card" style={{ width: '100%', flexDirection: 'column', alignItems: 'stretch' }}>
            <div style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>{editingItem ? "Editar Producto" : "Mantenimiento de Productos"}</h2>
              {editingItem && <a href="?tab=productos" style={{ fontSize: '0.875rem', color: 'var(--error)' }}>Cancelar Edición</a>}
            </div>
            <form action={Actions.handleCatalogAction} className="responsive-grid" style={{ padding: '1.5rem', background: 'var(--bg-app)', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'end' }}>
              <input type="hidden" name="id" value={editingItem?.id || ""} />
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Código / Referencia *</label>
                <input name="internal_code" defaultValue={(editingItem as any)?.internal_code || ""} required style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }} placeholder="Ej: REF-001" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Nombre del Producto *</label>
                <input name="technical_name" defaultValue={(editingItem as any)?.technical_name || ""} required style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }} placeholder="Ej: Glucosa Oxidasa" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Presentación Comercial</label>
                <input name="commercial_name" defaultValue={(editingItem as any)?.commercial_name || ""} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }} placeholder="Ej: Kit x 100 Det" />
              </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Categoría / Sección *</label>
                  <select name="section_id" defaultValue={(editingItem as any)?.section_id || ""} required style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <option value="">Seleccione...</option>
                    {sections?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Unidad de Compra</label>
                <input name="purchase_unit" defaultValue={(editingItem as any)?.purchase_unit || "Unidad"} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }} placeholder="Ej: Frasco x 500ml" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Stock Mínimo</label>
                <input type="number" name="minimum_stock_threshold" defaultValue={(editingItem as any)?.minimum_stock_threshold || 0} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }} />
              </div>
              <button type="submit" style={{ padding: '0.75rem 1.5rem', background: editingItem ? 'var(--warning)' : 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                {editingItem ? "Actualizar" : "Registrar"}
              </button>
            </form>
            <div className="table-responsive">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)', background: '#f8fafc' }}>
                    <th style={{ padding: '1rem' }}>Código</th>
                    <th style={{ padding: '1rem' }}>Producto</th>
                    <th style={{ padding: '1rem' }}>Presentación</th>
                    <th style={{ padding: '1rem' }}>Estado</th>
                    <th style={{ padding: '1rem' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {catalogItems?.map(i => (
                    <tr key={i.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{i.internal_code}</td>
                      <td style={{ padding: '1rem', fontWeight: 'bold' }}>{i.technical_name}</td>
                      <td style={{ padding: '1rem' }}>{i.commercial_name || "-"}</td>
                      <td style={{ padding: '1rem' }}>
                        <span className={`badge ${i.is_active ? 'badge-success' : 'badge-error'}`} style={{ padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.7rem', background: i.is_active ? '#dcfce7' : '#fee2e2', color: i.is_active ? '#10b981' : '#ef4444' }}>
                          {i.is_active ? 'ACTIVO' : 'INACTIVO'}
                        </span>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <a href={`?tab=productos&editId=${i.id}`} style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', border: '1px solid var(--border)', borderRadius: '6px', textDecoration: 'none', color: 'var(--navy)' }}>Editar</a>
                          <form action={Actions.toggleStatus.bind(null, i.id, !!i.is_active, 'product')}>
                            <button type="submit" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', color: i.is_active ? 'var(--error)' : 'var(--success)', cursor: 'pointer' }}>
                              {i.is_active ? 'Inactivar' : 'Activar'}
                            </button>
                          </form>
                          <DeleteMasterButton onDelete={Actions.handleDelete.bind(null, i.id, 'product')} />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(!catalogItems || catalogItems.length === 0) && (
                    <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No hay productos en el mantenimiento.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        .tab-link {
          text-decoration: none;
          color: var(--navy-light);
          font-weight: 700;
          font-size: 0.9375rem;
          padding: 0.5rem 1rem;
          border-radius: 8px;
          transition: all 0.2s;
        }
        .tab-link:hover { background: var(--bg-app); color: var(--primary); }
        .active-tab { background: var(--primary-light); color: var(--primary); }
      `}} />
    </div>
  );
}

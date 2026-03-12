import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CatalogService } from "@/lib/services/catalog";
import { revalidatePath } from "next/cache";
import DeleteMasterButton from "@/components/DeleteMasterButton";

export default async function ConfiguracionPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; editId?: string }>;
}) {
  const { tab, editId } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.app_metadata?.role !== "admin") {
    redirect("/dashboard");
  }

  const activeTab = tab || "secciones";

  // Data fetching based on active tab
  const [{ data: sections }, { data: suppliers }, { data: categories }, { data: locations }] = await Promise.all([
    CatalogService.getSections(),
    CatalogService.getSuppliers(),
    CatalogService.getCategories(),
    CatalogService.getLocations(),
  ]);

  // Find item to edit if editId is present
  const editingItem = editId ? (
    activeTab === "secciones" ? sections?.find(s => s.id === editId) :
    activeTab === "proveedores" ? suppliers?.find(s => s.id === editId) :
    activeTab === "categorias" ? categories?.find(c => c.id === editId) :
    locations?.find(l => l.id === editId)
  ) : null;

  // Server Actions for CRUD
  async function handleSectionAction(formData: FormData) {
    "use server";
    const name = formData.get("name") as string;
    const desc = formData.get("description") as string;
    const category_id = formData.get("category_id") as string;
    const id = formData.get("id") as string;
    
    await CatalogService.upsertSection({ 
      id: id || undefined, 
      name, 
      description: desc,
      category_id: category_id || null
    });
    revalidatePath("/dashboard/configuracion");
    if (id) redirect(`/dashboard/configuracion?tab=secciones`);
  }

  async function handleSupplierAction(formData: FormData) {
    "use server";
    const data = {
      id: (formData.get("id") as string) || undefined,
      name: formData.get("name") as string,
      contact_name: formData.get("contact_name") as string,
      contact_email: formData.get("contact_email") as string,
      tax_id: formData.get("tax_id") as string,
    };
    await CatalogService.upsertSupplier(data);
    revalidatePath("/dashboard/configuracion");
    if (data.id) redirect(`/dashboard/configuracion?tab=proveedores`);
  }

  async function handleCategoryAction(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;
    const name = formData.get("name") as string;
    const desc = formData.get("description") as string;
    await CatalogService.upsertCategory({ id: id || undefined, name, description: desc });
    revalidatePath("/dashboard/configuracion");
    if (id) redirect(`/dashboard/configuracion?tab=categorias`);
  }

  async function handleLocationAction(formData: FormData) {
    "use server";
    const data = {
      id: (formData.get("id") as string) || undefined,
      name: formData.get("name") as string,
      description: formData.get("description") as string,
      section_id: formData.get("section_id") as string,
      location_type: formData.get("location_type") as string,
    };
    await CatalogService.upsertLocation(data);
    revalidatePath("/dashboard/configuracion");
    if (data.id) redirect(`/dashboard/configuracion?tab=ubicaciones`);
  }

  async function toggleStatus(id: string, currentStatus: boolean, type: 'section' | 'supplier' | 'category' | 'location') {
    "use server";
    const newStatus = !currentStatus;
    if (type === 'section') await CatalogService.toggleSection(id, newStatus);
    else if (type === 'supplier') await CatalogService.toggleSupplier(id, newStatus);
    else if (type === 'category') await CatalogService.toggleCategory(id, newStatus);
    else if (type === 'location') await CatalogService.toggleLocation(id, newStatus);
    
    revalidatePath("/dashboard/configuracion");
  }

  async function handleDelete(id: string, type: 'section' | 'supplier' | 'category' | 'location') {
    "use server";
    if (type === 'section') await CatalogService.deleteSection(id);
    else if (type === 'supplier') await CatalogService.deleteSupplier(id);
    else if (type === 'category') await CatalogService.deleteCategory(id);
    else if (type === 'location') await CatalogService.deleteLocation(id);
    
    revalidatePath("/dashboard/configuracion");
  }

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
        <a href="?tab=secciones" className={`tab-link ${activeTab === 'secciones' ? 'active-tab' : ''}`}>Categorías de Inventario</a>
        <a href="?tab=proveedores" className={`tab-link ${activeTab === 'proveedores' ? 'active-tab' : ''}`}>Proveedores</a>
        <a href="?tab=categorias" className={`tab-link ${activeTab === 'categorias' ? 'active-tab' : ''}`}>Categorías Maestras (N1)</a>
        <a href="?tab=ubicaciones" className={`tab-link ${activeTab === 'ubicaciones' ? 'active-tab' : ''}`}>Ubicaciones</a>
      </div>

      <div className="config-content">
        {activeTab === "secciones" && (
          <div className="stat-card" style={{ width: '100%', flexDirection: 'column', alignItems: 'stretch' }}>
            <div style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>{editingItem ? "Editar Categoría de Inventario" : "Categorías de Inventario"}</h2>
              {editingItem && <a href="?tab=secciones" style={{ fontSize: '0.875rem', color: 'var(--error)' }}>Cancelar Edición</a>}
            </div>
            <form action={handleSectionAction} className="responsive-grid" style={{ padding: '1.5rem', background: 'var(--bg-app)', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '1rem', alignItems: 'end' }}>
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
                          <form action={toggleStatus.bind(null, s.id, !!s.is_active, 'section')}>
                            <button type="submit" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', color: s.is_active ? 'var(--error)' : 'var(--success)', cursor: 'pointer' }}>
                              {s.is_active ? 'Inactivar' : 'Activar'}
                            </button>
                          </form>
                          <DeleteMasterButton 
                            onDelete={handleDelete.bind(null, s.id, 'section')} 
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
             <form action={handleSupplierAction} className="responsive-grid" style={{ padding: '1.5rem', background: 'var(--bg-app)', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: '1rem', alignItems: 'end' }}>
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
                          <form action={toggleStatus.bind(null, sup.id, !!sup.is_active, 'supplier')}>
                            <button type="submit" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', color: sup.is_active ? 'var(--error)' : 'var(--success)', cursor: 'pointer' }}>
                              {sup.is_active ? 'Inactivar' : 'Activar'}
                            </button>
                          </form>
                          <DeleteMasterButton 
                            onDelete={handleDelete.bind(null, sup.id, 'supplier')} 
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
            <form action={handleCategoryAction} className="responsive-grid" style={{ padding: '1.5rem', background: 'var(--bg-app)', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '1rem', alignItems: 'end' }}>
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
                          <form action={toggleStatus.bind(null, c.id, !!c.is_active, 'category')}>
                            <button type="submit" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', color: c.is_active ? 'var(--error)' : 'var(--success)', cursor: 'pointer' }}>
                              {c.is_active ? 'Inactivar' : 'Activar'}
                            </button>
                          </form>
                          <DeleteMasterButton 
                            onDelete={handleDelete.bind(null, c.id, 'category')} 
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
              <h2>{editingItem ? "Editar Ubicación" : "Ubicaciones Físicas"}</h2>
              {editingItem && <a href="?tab=ubicaciones" style={{ fontSize: '0.875rem', color: 'var(--error)' }}>Cancelar Edición</a>}
            </div>
            <form action={handleLocationAction} className="responsive-grid" style={{ padding: '1.5rem', background: 'var(--bg-app)', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '1rem', alignItems: 'end' }}>
              <input type="hidden" name="id" value={editingItem?.id || ""} />
              <input name="name" defaultValue={editingItem?.name || ""} placeholder="Nombre (ej: Nevera A1)" required style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }} />
              <select name="section_id" defaultValue={(editingItem as any)?.section_id || ""} required style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                {sections?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select name="location_type" defaultValue={(editingItem as any)?.location_type || "shelf"} style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <option value="shelf">Estantería</option>
                <option value="refrigerator">Nevera</option>
                <option value="freezer">Congelador</option>
              </select>
              <button type="submit" style={{ padding: '0.75rem 1.5rem', background: editingItem ? 'var(--warning)' : 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>
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
                          <form action={toggleStatus.bind(null, l.id, !!l.is_active, 'location')}>
                            <button type="submit" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', color: l.is_active ? 'var(--error)' : 'var(--success)', cursor: 'pointer' }}>
                              {l.is_active ? 'Inactivar' : 'Activar'}
                            </button>
                          </form>
                          <DeleteMasterButton 
                            onDelete={handleDelete.bind(null, l.id, 'location')} 
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
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
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

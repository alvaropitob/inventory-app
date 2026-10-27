import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/services/user";
import { CatalogService } from "@/lib/services/catalog";
import DeleteMasterButton from "@/components/DeleteMasterButton";
import * as Actions from "./actions";
import ProductMaintenanceList from "@/components/ProductMaintenanceList";
import ProductTechnicalFields from "@/components/ProductTechnicalFields";

export const dynamic = "force-dynamic";

interface Category {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

interface Section {
  id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  is_active: boolean;
  categories?: { name: string } | null;
}

interface Supplier {
  id: string;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  tax_id: string | null;
  is_active: boolean;
}

interface Location {
  id: string;
  name: string;
  section_id: string | null;
  location_type: string;
  is_active: boolean;
  sections?: { name: string } | null;
}

interface CatalogItem {
  id: string;
  internal_code: string;
  technical_name: string;
  commercial_name: string | null;
  section_id: string;
  purchase_unit: string | null;
  minimum_stock_threshold: number | null;
  maximum_stock_threshold: number | null;
  estimated_unit_price: number | null;
  supplier_id: string | null;
  product_type: "medicamento" | "dispositivo_medico" | "reactivo" | "insumo";
  series: string | null;
  brand: string | null;
  product_description: string | null;
  active_ingredient: string | null;
  dosage_form: string | null;
  concentration: string | null;
  commercial_presentation: string | null;
  sanitary_registration: string | null;
  risk_classification: "I" | "II" | "IIA" | "IIB" | "III" | "not_applicable" | null;
  shelf_life: string | null;
  is_active: boolean;
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span className={`pill-badge ${active ? 'pill-green' : 'pill-red'}`}>
      {active ? 'ACTIVO' : 'INACTIVO'}
    </span>
  );
}

export default async function ConfiguracionPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; editId?: string; sectionId?: string }>;
}) {
  const { tab, editId, sectionId } = await searchParams;
  const user = await getCurrentUserProfile();

  if (!user || user.role !== "admin") {
    redirect("/dashboard");
  }

  const activeTab = tab || "secciones";

  const [
    { data: rawSections },
    { data: rawSuppliers },
    { data: rawCategories },
    { data: rawLocations },
    { data: rawCatalogItems },
  ] = await Promise.all([
    CatalogService.getSections(),
    CatalogService.getSuppliers(),
    CatalogService.getCategories(),
    CatalogService.getLocations(),
    CatalogService.getCatalogItems(),
  ]);

  const sections = rawSections as Section[] | null;
  const suppliers = rawSuppliers as Supplier[] | null;
  const categories = rawCategories as Category[] | null;
  const locations = rawLocations as Location[] | null;
  const catalogItems = rawCatalogItems as CatalogItem[] | null;

  const editingItem = editId ? (
    activeTab === "secciones"   ? sections?.find(s => s.id === editId) :
    activeTab === "proveedores" ? suppliers?.find(s => s.id === editId) :
    activeTab === "categorias"  ? categories?.find(c => c.id === editId) :
    activeTab === "ubicaciones" ? locations?.find(l => l.id === editId) :
    activeTab === "productos"   ? catalogItems?.find(i => i.id === editId) :
    null
  ) : null;

  const tabs = [
    { key: 'secciones', label: 'Áreas' },
    { key: 'categorias', label: 'Categorías' },
    { key: 'proveedores', label: 'Proveedores' },
    { key: 'productos', label: 'Productos' },
    { key: 'ubicaciones', label: 'Ubicaciones de Almacenamiento' },
  ];

  return (
    <div className="dashboard-main">
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Configuración de Maestros</h1>
          <p className="page-header-subtitle">Gestiona los pilares estructurales del laboratorio clínico.</p>
        </div>
      </div>

      <nav className="tabs-nav">
        {tabs.map(t => (
          <a key={t.key} href={`?tab=${t.key}`} className={`tab-link${activeTab === t.key ? ' tab-link-active' : ''}`}>
            {t.label}
          </a>
        ))}
      </nav>

      <div className="config-content">
        {activeTab === "secciones" && (
          <div className="form-card">
            <div className="card-section-header">
              <h2 className="card-section-title">{editingItem ? "Editar área" : "Áreas"}</h2>
              {editingItem && <a href="?tab=secciones" className="cell-link text-error">Cancelar Edición</a>}
            </div>
            <form action={Actions.handleSectionAction} className="config-form-panel config-form-compact">
              <input type="hidden" name="id" value={(editingItem as Section)?.id || ""} />
              <div className="form-group">
                <label className="form-label">Nombre del área</label>
                <input className="form-input" name="name" defaultValue={(editingItem as Section)?.name || ""} required placeholder="Ej: Hematología" />
              </div>
              <div className="form-group">
                <label className="form-label">Descripción</label>
                <input className="form-input" name="description" defaultValue={(editingItem as Section)?.description || ""} placeholder="Breve descripción..." />
              </div>
              <button type="submit" className={editingItem ? 'btn-warning' : 'btn-primary'}>
                {editingItem ? "Actualizar" : "Añadir"}
              </button>
            </form>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Descripción</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {sections?.map((s: Section) => (
                    <tr key={s.id}>
                      <td className="cell-primary">{s.name}</td>
                      <td className="cell-secondary">{s.description}</td>
                      <td><StatusPill active={s.is_active} /></td>
                      <td>
                        <div className="action-group">
                          <a href={`?tab=secciones&editId=${s.id}`} className="action-btn-edit">Editar</a>
                          <form action={Actions.toggleStatus.bind(null, s.id, !!s.is_active, 'section')}>
                            <button type="submit" className={s.is_active ? 'action-btn-toggle-inactive' : 'action-btn-toggle-active'}>
                              {s.is_active ? 'Inactivar' : 'Activar'}
                            </button>
                          </form>
                          <DeleteMasterButton
                            onDelete={Actions.handleDelete.bind(null, s.id, 'section')}
                            confirmMessage={`¿Seguro quieres eliminar el área "${s.name}"?`}
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
          <div className="form-card">
            <div className="card-section-header">
              <h2 className="card-section-title">{editingItem ? "Editar Proveedor" : "Registro de Proveedores"}</h2>
              {editingItem && <a href="?tab=proveedores" className="cell-link text-error">Cancelar Edición</a>}
            </div>
            <form action={Actions.handleSupplierAction} className="config-form-panel config-form-wide">
              <input type="hidden" name="id" value={(editingItem as Supplier)?.id || ""} />
              <div className="form-group">
                <label className="form-label">Nombre Proveedor</label>
                <input className="form-input" name="name" defaultValue={(editingItem as Supplier)?.name || ""} required placeholder="Ej: Roche Diagnostics" />
              </div>
              <div className="form-group">
                <label className="form-label">Contacto</label>
                <input className="form-input" name="contact_name" defaultValue={(editingItem as Supplier)?.contact_name || ""} placeholder="Nombre del asesor" />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" name="contact_email" type="email" defaultValue={(editingItem as Supplier)?.contact_email || ""} placeholder="email@proveedor.com" />
              </div>
              <div className="form-group">
                <label className="form-label">NIT / Tax ID</label>
                <input className="form-input" name="tax_id" defaultValue={(editingItem as Supplier)?.tax_id || ""} placeholder="800.123.456-7" />
              </div>
              <button type="submit" className={editingItem ? 'btn-warning' : 'btn-primary'}>
                {editingItem ? "Actualizar" : "Añadir"}
              </button>
            </form>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Empresa</th>
                    <th>Contacto</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers?.map((sup: Supplier) => (
                    <tr key={sup.id}>
                      <td className="cell-primary">{sup.name}</td>
                      <td>
                        <div>{sup.contact_name}</div>
                        <div className="cell-muted">{sup.contact_email}</div>
                      </td>
                      <td><StatusPill active={sup.is_active} /></td>
                      <td>
                        <div className="action-group">
                          <a href={`?tab=proveedores&editId=${sup.id}`} className="action-btn-edit">Editar</a>
                          <form action={Actions.toggleStatus.bind(null, sup.id, !!sup.is_active, 'supplier')}>
                            <button type="submit" className={sup.is_active ? 'action-btn-toggle-inactive' : 'action-btn-toggle-active'}>
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
          <div className="form-card">
            <div className="card-section-header">
              <h2 className="card-section-title">{editingItem ? "Editar Categoría Maestra" : "Categorías Maestras (Nivel Superior)"}</h2>
              {editingItem && <a href="?tab=categorias" className="cell-link text-error">Cancelar Edición</a>}
            </div>
            <form action={Actions.handleCategoryAction} className="config-form-panel config-form-compact">
              <input type="hidden" name="id" value={(editingItem as Category)?.id || ""} />
              <div className="form-group">
                <label className="form-label">Nombre Categoría</label>
                <input className="form-input" name="name" defaultValue={(editingItem as Category)?.name || ""} required placeholder="Ej: Reactivos" />
              </div>
              <div className="form-group">
                <label className="form-label">Descripción</label>
                <input className="form-input" name="description" defaultValue={(editingItem as Category)?.description || ""} placeholder="Uso general de la categoría" />
              </div>
              <button type="submit" className={editingItem ? 'btn-warning' : 'btn-primary'}>
                {editingItem ? "Actualizar" : "Añadir"}
              </button>
            </form>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Descripción</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {categories?.map((c: Category) => (
                    <tr key={c.id}>
                      <td className="cell-primary">{c.name}</td>
                      <td className="cell-secondary">{c.description}</td>
                      <td><StatusPill active={c.is_active} /></td>
                      <td>
                        <div className="action-group">
                          <a href={`?tab=categorias&editId=${c.id}`} className="action-btn-edit">Editar</a>
                          <form action={Actions.toggleStatus.bind(null, c.id, !!c.is_active, 'category')}>
                            <button type="submit" className={c.is_active ? 'action-btn-toggle-inactive' : 'action-btn-toggle-active'}>
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
          <div className="form-card">
            <div className="card-section-header">
              <h2 className="card-section-title">{editingItem ? "Editar Ubicación" : "Ubicaciones de Almacenamiento"}</h2>
              {editingItem && <a href="?tab=ubicaciones" className="cell-link text-error">Cancelar Edición</a>}
            </div>
            <form action={Actions.handleLocationAction} className="config-form-panel config-form-location">
              <input type="hidden" name="id" value={(editingItem as Location)?.id || ""} />
              <div className="form-group">
                <label className="form-label">Nombre Ubicación</label>
                <input className="form-input" name="name" defaultValue={(editingItem as Location)?.name || ""} required placeholder="Ej: Nevera 1 - Estante A" />
              </div>
              <div className="form-group">
                <label className="form-label">Área *</label>
                <select className="form-select" name="section_id" defaultValue={(editingItem as Location)?.section_id || sectionId || ""} required>
                  <option value="" disabled>Seleccione un área...</option>
                  {sections?.filter(section => section.is_active).map(section => (
                    <option key={section.id} value={section.id}>{section.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Tipo de Almacenamiento</label>
                <select className="form-select" name="location_type" defaultValue={(editingItem as Location)?.location_type || "refrigerated"}>
                  <option value="refrigerated">Refrigerado (2-8°C)</option>
                  <option value="room_temp">Ambiente (15-25°C)</option>
                  <option value="frozen">Congelado (-20°C)</option>
                </select>
              </div>
              <button type="submit" className={editingItem ? 'btn-warning' : 'btn-primary'}>
                {editingItem ? "Actualizar" : "Añadir"}
              </button>
            </form>
            {locations?.some(location => !location.section_id) && (
              <p className="location-assignment-notice" role="status">
                Hay ubicaciones sin área asignada. Edítalas para que puedan aparecer al recibir productos de su área.
              </p>
            )}
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Área</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {locations?.map((l: Location) => (
                    <tr key={l.id}>
                      <td className="cell-primary">{l.name}</td>
                      <td>
                        {l.sections?.name
                          ? <span className="pill-badge pill-blue">{l.sections.name}</span>
                          : <span className="pill-badge pill-amber">Sin área asignada</span>}
                      </td>
                      <td><StatusPill active={l.is_active} /></td>
                      <td>
                        <div className="action-group">
                          <a href={`?tab=ubicaciones&editId=${l.id}`} className="action-btn-edit">Editar</a>
                          <form action={Actions.toggleStatus.bind(null, l.id, !!l.is_active, 'location')}>
                            <button type="submit" className={l.is_active ? 'action-btn-toggle-inactive' : 'action-btn-toggle-active'}>
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
          <div className="form-card">
            <div className="card-section-header">
              <h2 className="card-section-title">{editingItem ? "Editar Producto" : "Mantenimiento de Productos"}</h2>
              {editingItem && <a href="?tab=productos" className="cell-link text-error">Cancelar Edición</a>}
            </div>
            <form action={Actions.handleCatalogAction} className="config-form-panel config-product-form">
              <input type="hidden" name="id" value={(editingItem as CatalogItem)?.id || ""} />
              <div>
                <label className="form-label">Código / Referencia *</label>
                <input className="form-input" name="internal_code" defaultValue={(editingItem as CatalogItem)?.internal_code || ""} required placeholder="Ej: REF-001" />
              </div>
              <div>
                <label className="form-label">Nombre del Producto *</label>
                <input className="form-input" name="technical_name" defaultValue={(editingItem as CatalogItem)?.technical_name || ""} required placeholder="Ej: Glucosa Oxidasa" />
              </div>
              <ProductTechnicalFields
                initial={editingItem as CatalogItem | null}
                suppliers={(suppliers || []).filter(supplier => supplier.is_active !== false)}
                sections={(sections || []).filter(section => section.is_active)}
                supplierId={(editingItem as CatalogItem | null)?.supplier_id || ""}
                configurationMode
              />
              <div>
                <label className="form-label">Stock Mínimo</label>
                <input className="form-input" type="number" min="0" step="1" name="minimum_stock_threshold" defaultValue={(editingItem as CatalogItem)?.minimum_stock_threshold || 0} />
              </div>
              <div>
                <label className="form-label">Stock Máximo (opcional)</label>
                <input className="form-input" type="number" min="0" step="1" name="maximum_stock_threshold" defaultValue={(editingItem as CatalogItem)?.maximum_stock_threshold ?? ""} />
              </div>
              <div>
                <label className="form-label">P. Estimado ($)</label>
                <input className="form-input" type="number" step="0.01" name="estimated_unit_price" defaultValue={(editingItem as CatalogItem)?.estimated_unit_price || 0} />
              </div>
              <button type="submit" className={editingItem ? 'btn-warning' : 'btn-primary'}>
                {editingItem ? "Actualizar" : "Registrar"}
              </button>
            </form>
            <ProductMaintenanceList
              initialItems={catalogItems || []}
              toggleStatusAction={Actions.toggleStatus}
              handleDeleteAction={Actions.handleDelete}
            />
          </div>
        )}
      </div>
    </div>
  );
}

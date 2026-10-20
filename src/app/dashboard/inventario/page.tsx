import { redirect } from "next/navigation";
import { CatalogService } from "@/lib/services/catalog";
import { StockService } from "@/lib/services/stock";
import { getCurrentUserProfile } from "@/lib/services/user";
import DeleteMasterButton from "@/components/DeleteMasterButton";
import InventoryProductSelector from "@/components/InventoryProductSelector";
import ExportCSVButton from "@/components/ExportCSVButton";
import RealtimeStockTable from "./RealtimeStockTable";
import ContextualHelp from "@/components/ContextualHelp";
import * as Actions from "./actions";
import CollapsibleSection from "@/components/CollapsibleSection";
import ClinicalOutputForm from "@/components/ClinicalOutputForm";
import { AlertTriangle, ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, ClipboardList, FileText, Package, Trash2, X } from "lucide-react";

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

function movementLabel(type: string) {
  if (type === 'entry') return 'Entrada';
  if (type === 'exit') return 'Salida';
  if (type === 'adjustment') return 'Ajuste';
  return 'Descarte';
}

function movementBadgeClass(type: string) {
  if (type === 'entry') return 'movement-badge movement-badge-entry';
  if (type === 'exit') return 'movement-badge movement-badge-exit';
  return 'movement-badge movement-badge-adjust';
}

function movementQtyClass(type: string) {
  if (type === 'entry') return 'qty-entry';
  if (type === 'exit') return 'qty-exit';
  return 'qty-adjust';
}

export default async function InventarioPage({
  searchParams,
}: {
  searchParams: Promise<{ editId?: string; view?: string; error?: string }>;
}) {
  const { editId, view, error } = await searchParams;
  const user = await getCurrentUserProfile();
  if (!user) redirect("/auth/login");

  const [
    { data: catalogItems },
    { data: sections },
    { data: suppliers },
    { data: locations },
    { data: allBatches },
    { data: allMovements }
  ] = await Promise.all([
    CatalogService.getCatalogItems(),
    CatalogService.getSections(),
    CatalogService.getSuppliers(),
    CatalogService.getLocations(),
    StockService.getAllBatches(),
    StockService.getAllMovements(),
  ]);

  const editingItem = editId ? catalogItems?.find(i => i.id === editId) : null;

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

  const currentView = view || "entradas";
  const activeBatches = (allBatches || []).filter((batch: Batch) => batch.current_stock > 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysUntilExpiry = (batch: Batch) =>
    Math.ceil((new Date(`${batch.expiration_date}T00:00:00`).getTime() - today.getTime()) / 86_400_000);
  const criticalExpiryCount = activeBatches.filter((batch: Batch) => daysUntilExpiry(batch) <= 15).length;
  const warningExpiryCount = activeBatches.filter((batch: Batch) => daysUntilExpiry(batch) > 15 && daysUntilExpiry(batch) <= 45).length;
  const validBatchCount = activeBatches.filter((batch: Batch) => daysUntilExpiry(batch) > 45).length;
  const quarantineBatchCount = activeBatches.filter((batch: Batch) => batch.clinical_status === 'quarantine').length;

  const productIdsWithStock = new Set(allBatches?.map((b: Batch) => b.item_id) || []);
  const catalogWithEntries = catalogItems?.filter((item: CatalogItem) => productIdsWithStock.has(item.id)) || [];

  const consolidatedStock = catalogItems?.map((item: CatalogItem) => {
    const itemBatches = allBatches?.filter((b: Batch) => b.item_id === item.id) || [];
    const totalStock = itemBatches.reduce((acc: number, b: Batch) => acc + (b.current_stock || 0), 0);
    return { ...item, itemBatches, totalStock };
  }).filter((item: CatalogItem & { totalStock: number, itemBatches: Batch[] }) =>
    item.totalStock > 0 || (item.itemBatches && item.itemBatches.length > 0)
  ).sort((a, b) => a.technical_name.localeCompare(b.technical_name)) || [];

  return (
    <div className="dashboard-main">
      <div className="welcome-section">
        <h1 className="page-header-title">Gestión de Inventario</h1>
        <p>Control de entradas, salidas y existencias del laboratorio.</p>
      </div>

      <section className="inventory-metrics" aria-label="Resumen de lotes activos">
        <article className="inventory-metric inventory-metric-critical">
          <span className="inventory-metric-label">Vencimiento crítico</span>
          <strong>{criticalExpiryCount} lotes</strong>
          <span className="inventory-metric-note">Vencidos o vencen en 15 días</span>
        </article>
        <article className="inventory-metric inventory-metric-warning">
          <span className="inventory-metric-label">Alerta FEFO</span>
          <strong>{warningExpiryCount} lotes</strong>
          <span className="inventory-metric-note">Vencen entre 16 y 45 días</span>
        </article>
        <article className="inventory-metric inventory-metric-success">
          <span className="inventory-metric-label">Lotes vigentes</span>
          <strong>{validBatchCount} lotes</strong>
          <span className="inventory-metric-note">Más de 45 días de vigencia</span>
        </article>
        <article className="inventory-metric inventory-metric-neutral">
          <span className="inventory-metric-label">En cuarentena</span>
          <strong>{quarantineBatchCount} lotes</strong>
          <span className="inventory-metric-note">Pendientes de liberación técnica</span>
        </article>
      </section>

      {/* Tab Navigation */}
      <nav className="tabs-nav">
        {[
          { key: 'entradas',    label: 'Entrada de Productos' },
          { key: 'stock',       label: 'Stock Actual' },
          { key: 'salidas',     label: 'Salida de Productos' },
          { key: 'traslados',   label: 'Traslados Internos' },
          { key: 'bajas',       label: 'Bajas y Disposición Final' },
          { key: 'movimientos', label: 'Kardex (Historial)' },
        ].map(tab => (
          <a
            key={tab.key}
            href={`?view=${tab.key}`}
            className={`tab-link ${currentView === tab.key ? 'tab-link-active' : ''}`}
          >
            {tab.label}
          </a>
        ))}
      </nav>

      <div className="config-content">
        {error && (
          <div className="alert-error">
            <AlertTriangle className="ui-icon" aria-hidden="true" />
            <div>
              <strong>Error al guardar:</strong> {decodeURIComponent(error)}
            </div>
            <a href="?view=entradas" className="alert-error-close" aria-label="Cerrar alerta"><X className="ui-icon" aria-hidden="true" /></a>
          </div>
        )}

        {/* ====== ENTRADAS ====== */}
        {currentView === 'entradas' && (
          <>
            <CollapsibleSection
              title="Nuevo Registro en Catálogo"
              subtitle="Defina los productos maestros que ingresarán al inventario."
              icon={<Package className="ui-icon" aria-hidden="true" />}
            >
              <div className="form-card">
                <div className="form-card-header">
                  <h2 className="form-card-title">
                    {editingItem ? "Editar Producto" : "Nuevo Registro en Catálogo"}
                  </h2>
                  {editingItem && (
                    <a href="?view=entradas" style={{ fontSize: '0.875rem', color: 'var(--error)', textDecoration: 'none' }}>
                      Cancelar Edición
                    </a>
                  )}
                </div>

                <InventoryProductSelector products={catalogItems || []} currentId={editId} />

                <form key={editId || 'new'} action={Actions.handleCatalogAction} className="form-card-body">
                  <input type="hidden" name="id" value={editingItem?.id || ""} />

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                    {/* Master / Technical */}
                    <div className={editingItem ? 'form-section-readonly' : 'form-section'}>
                      <div className="form-section-header">
                        <h3 className="form-section-title">
                          {editingItem ? <><FileText className="ui-icon" aria-hidden="true" /> Ficha Técnica (Maestro)</> : "Información Básica"}
                        </h3>
                        {editingItem && <span className="readonly-badge">Solo Lectura</span>}
                      </div>

                      <div className="form-fields">
                        <div className="form-grid-1-25">
                          <div>
                            <label className="form-label">Código / REF</label>
                            <input
                              name="internal_code"
                              defaultValue={editingItem?.internal_code || ""}
                              required
                              readOnly={!!editingItem}
                              placeholder="REF-001"
                              className={`form-input ${editingItem ? 'form-input-readonly' : ''}`}
                            />
                          </div>
                          <div>
                            <label className="form-label">Nombre Técnico</label>
                            <input
                              name="technical_name"
                              defaultValue={editingItem?.technical_name || ""}
                              required
                              readOnly={!!editingItem}
                              placeholder="Ej: Glucosa Oxidasa"
                              className={`form-input ${editingItem ? 'form-input-readonly' : ''}`}
                            />
                          </div>
                        </div>

                        <div className="form-grid-1-12">
                          <div>
                            <label className="form-label">Presentación / Comercial</label>
                            <input
                              name="commercial_name"
                              defaultValue={editingItem?.commercial_name || ""}
                              readOnly={!!editingItem}
                              placeholder="Ej: Kit KIT01"
                              className={`form-input ${editingItem ? 'form-input-readonly' : ''}`}
                            />
                          </div>
                          <div>
                            <label className="form-label">Registro Sanitario / INVIMA</label>
                            <input
                              name="sanitary_registration"
                              defaultValue={editingItem?.sanitary_registration || ""}
                              placeholder="Ej: INVIMA 2024RD-..."
                              className="form-input"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="form-label">Categoría / Clasificación</label>
                          {editingItem ? (
                            <div className="form-readonly-field">
                              {sections?.find(s => s.id === editingItem.section_id)?.name || "Sin Categoría"}
                              <input type="hidden" name="section_id" value={editingItem.section_id || ""} />
                            </div>
                          ) : (
                            <select name="section_id" required className="form-select">
                              <option value="">Seleccione Categoría...</option>
                              {sections?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Purchase / Stock Entry */}
                    <div className="form-section">
                      <div className="form-section-header">
                        <h3 className="form-section-title"><ArrowDownToLine className="ui-icon" aria-hidden="true" /> Registro de Compra / Entrada</h3>
                        <ContextualHelp
                          content={{
                            title: "Ingreso de Stock",
                            description: "Registra nuevos lotes adquiridos. El sistema aplicará automáticamente la política FEFO (First Expired, First Out) basada en la fecha de vencimiento que ingreses.",
                            tips: ["Verifique que el número de lote coincida con la factura."]
                          }}
                        />
                      </div>

                      <div className="form-fields">
                        <div>
                          <label className="form-label">Proveedor Habitual *</label>
                          <select
                            name="supplier_id"
                            defaultValue={latestBatch?.supplier_id || editingItem?.supplier_id || ""}
                            required
                            className="form-select"
                          >
                            <option value="">Seleccione Proveedor...</option>
                            {suppliers?.map(sup => <option key={sup.id} value={sup.id}>{sup.name}</option>)}
                          </select>
                        </div>

                        <div className="form-grid-2">
                          <div>
                            <label className="form-label">Lote / Batch *</label>
                            <input
                              name="batch_number"
                              defaultValue={latestBatch?.batch_number || ""}
                              required
                              placeholder="Ej: LOT-2024-001"
                              className="form-input"
                            />
                          </div>
                          <div>
                            <label className="form-label">Fecha de Vencimiento *</label>
                            <input
                              type="date"
                              name="expiration_date"
                              defaultValue={latestBatch?.expiration_date ? new Date(latestBatch.expiration_date).toISOString().split('T')[0] : ""}
                              required
                              className="form-input"
                            />
                          </div>
                        </div>

                        <div className="form-grid-2">
                          <div>
                            <label className="form-label">Cantidad (Total Unidades) *</label>
                            <input type="number" name="quantity" defaultValue="1" min="1" required className="form-input" />
                          </div>
                          <div>
                            <label className="form-label">Ubicación de Almacenamiento *</label>
                            <select name="location_id" defaultValue={latestBatch?.location_id || ""} required className="form-select">
                              <option value="">Seleccione Ubicación...</option>
                              {locations?.map(loc => <option key={loc.id} value={loc.id}>{loc.name} ({loc.location_type})</option>)}
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="form-actions">
                    <button type="submit" className={editingItem ? 'btn-warning' : 'btn-primary'}>
                      {editingItem ? "Actualizar Producto" : "Registrar Producto"}
                    </button>
                  </div>
                </form>
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              title="Catálogo Vigente"
              subtitle="Consulta y gestión de productos maestros."
              icon={<ClipboardList className="ui-icon" aria-hidden="true" />}
            >
              <div className="data-card">
                <div className="data-card-body">
                  <div className="table-responsive">
                    <table className="kardex-table">
                      <thead>
                        <tr>
                          <th>Código</th>
                          <th>Nombre del Producto</th>
                          <th>Categoría</th>
                          <th>Presentación</th>
                          <th>Mín. Stock</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {catalogWithEntries?.map((i: CatalogItem) => (
                          <tr key={i.id}>
                            <td className="cell-muted">{i.internal_code}</td>
                            <td>
                              <div className="cell-primary">{i.technical_name}</div>
                              <div className="cell-muted">{i.commercial_name}</div>
                            </td>
                            <td style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '0.85rem' }}>{i.sections?.name}</td>
                            <td>{i.purchase_unit}</td>
                            <td style={{ fontWeight: 700 }}>{i.minimum_stock_threshold}</td>
                            <td>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <a href={`?view=entradas&editId=${i.id}`} className="action-btn-edit">Editar</a>
                                <form action={Actions.toggleStatus.bind(null, i.id, !!i.is_active)}>
                                  <button type="submit" className={i.is_active ? 'action-btn-toggle-inactive' : 'action-btn-toggle-active'}>
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
                            <td colSpan={6} className="empty-state">
                              No hay productos registrados en el catálogo aún.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </CollapsibleSection>
          </>
        )}

        {/* ====== STOCK ====== */}
        {currentView === 'stock' && (
          <div className="data-card">
            <div className="card-section-header">
              <div>
                <h2 className="card-section-title">Stock Actual Consolidado</h2>
                <p className="card-section-subtitle">Visión global y en tiempo real de las existencias disponibles por producto.</p>
              </div>
              <ExportCSVButton
                filename="Reporte_Stock_Actual"
                data={consolidatedStock.map((row: CatalogItem & { totalStock: number, itemBatches: Batch[] }) => ({
                  'Código': row.internal_code || 'N/A',
                  'Producto': row.technical_name || 'N/A',
                  'Nombre Comercial': row.commercial_name || 'N/A',
                  'Categoría': row.sections?.name || 'Genérico',
                  'Stock Total': row.totalStock,
                  'Unidad de Compra': row.purchase_unit || 'N/A',
                  'Lotes Disponibles': row.itemBatches?.filter((b: Batch) => b.current_stock > 0).map((b: Batch) => `${b.batch_number}:${b.current_stock}`).join(' | ') || 'Agotado',
                  'Estado': row.totalStock === 0 ? 'Agotado' : row.totalStock <= (row.minimum_stock_threshold || 10) ? 'Stock Bajo' : 'Óptimo'
                }))}
              />
            </div>
            <RealtimeStockTable initialBatches={allBatches || []} />
          </div>
        )}

        {/* ====== SALIDAS (FEFO ESTRICTO + ESCÁNER GS1-128) ====== */}
        {currentView === 'salidas' && (
          <CollapsibleSection
            title="Registrar Salida / Consumo Clínico"
            subtitle="Despacho con algoritmo estricto FEFO (First Expired, First Out), escáner GS1-128 y control de estabilidad post-apertura."
            icon={<ArrowUpFromLine className="ui-icon" aria-hidden="true" />}
          >
            <div className="form-card" style={{ padding: '1.5rem' }}>
              <ClinicalOutputForm batches={allBatches || []} action={Actions.handleConsumeAction} />
            </div>
          </CollapsibleSection>
        )}

        {/* ====== TRASLADOS INTERNOS ====== */}
        {currentView === 'traslados' && (
          <CollapsibleSection
            title="Traslado Interno entre Ubicaciones y Sedes"
            subtitle="Reubicación de reactivos e insumos entre bodegas, neveras y áreas analíticas con trazabilidad completa."
            icon={<ArrowLeftRight className="ui-icon" aria-hidden="true" />}
          >
            <div className="form-card">
              <div className="form-card-header">
                <div>
                  <h2 className="form-card-title">Formulario de Reubicación / Traslado</h2>
                  <p className="form-card-subtitle">
                    Seleccione el lote origen y la ubicación de destino. El sistema registrará el movimiento en el Kardex y actualizará el stock disponible en cada ubicación.
                  </p>
                </div>
              </div>

              <form action={Actions.handleTransferAction} className="form-body">
                <div className="form-grid">
                  <div className="form-field-full">
                    <label className="form-label">Lote e Insumo a Trasladar *</label>
                    <select name="batch_id" required className="form-select">
                      <option value="">-- Seleccione lote origen con stock disponible --</option>
                      {(allBatches || [])
                        .filter((b: Batch) => b.current_stock > 0)
                        .map((b: Batch) => (
                          <option key={b.id} value={b.id}>
                            {b.item?.technical_name || b.catalog_items?.technical_name} | Lote: {b.batch_number} | Stock: {b.current_stock} | Ubicación Actual: [{b.locations?.name || "Sin Asignar"}]
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="form-field-half">
                    <label className="form-label">Ubicación / Nevera de Destino *</label>
                    <select name="destination_location_id" required className="form-select">
                      <option value="">-- Seleccione nueva ubicación o sede --</option>
                      {(locations || [])
                        .filter((loc: { is_active?: boolean }) => loc.is_active !== false)
                        .map((loc: { id: string; name: string; location_type?: string }) => (
                          <option key={loc.id} value={loc.id}>
                            {loc.name} {loc.location_type ? `(${loc.location_type})` : ""}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="form-field-half">
                    <label className="form-label">Cantidad a Trasladar *</label>
                    <input
                      type="number"
                      name="quantity"
                      min="1"
                      required
                      placeholder="Ej: 5"
                      className="form-input"
                    />
                  </div>

                  <div className="form-field-full">
                    <label className="form-label">Motivo o Justificación del Traslado</label>
                    <input
                      type="text"
                      name="reason"
                      placeholder="Ej: Reabastecimiento de Nevera Hematología / Traslado a Sede Norte / Mantenimiento de equipo de frío..."
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="form-actions-center" style={{ marginTop: '1.5rem' }}>
                  <button
                    type="submit"
                    style={{
                      padding: '0.75rem 2rem',
                      borderRadius: '8px',
                      backgroundColor: 'var(--navy)',
                      color: '#ffffff',
                      border: 'none',
                      fontWeight: 700,
                      fontSize: '0.925rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      boxShadow: 'var(--shadow-md)',
                    }}
                  >
                    <ArrowLeftRight className="ui-icon" aria-hidden="true" /> Confirmar Traslado de Inventario
                  </button>
                </div>
              </form>
            </div>
          </CollapsibleSection>
        )}

        {/* ====== BAJAS Y DISPOSICIÓN FINAL ====== */}
        {currentView === 'bajas' && (
          <CollapsibleSection
            title="Acta de Baja y Disposición Final de Residuos"
            subtitle="Descarte formal de reactivos vencidos, mermas, contaminación o material no conforme (Normativa Ambiental e INVIMA)."
            icon={<Trash2 className="ui-icon" aria-hidden="true" />}
          >
            <div className="form-card">
              <div className="form-card-header">
                <div>
                  <h2 className="form-card-title">Registro Oficial de Baja Técnica</h2>
                  <p className="form-card-subtitle">
                    Descarga definitiva del inventario con trazabilidad auditable para inspectores de salud y gestión ambiental.
                  </p>
                </div>
              </div>

              <form action={Actions.handleDiscardAction} className="form-body">
                <div className="form-grid">
                  <div className="form-field-full">
                    <label className="form-label">Seleccionar Lote / Insumo para Baja *</label>
                    <select name="batch_id" required className="form-select">
                      <option value="">-- Seleccione el lote a dar de baja --</option>
                      {(allBatches || [])
                        .filter((b: Batch) => b.current_stock > 0)
                        .map((b: Batch) => {
                          const isExpired = new Date(b.expiration_date) < new Date();
                          return (
                            <option key={b.id} value={b.id}>
                              {b.item?.technical_name || b.catalog_items?.technical_name} | Lote: {b.batch_number} | Stock: {b.current_stock} | Vence: {new Date(b.expiration_date).toLocaleDateString()} {isExpired ? "[VENCIDO]" : ""}
                            </option>
                          );
                        })}
                    </select>
                  </div>

                  <div className="form-field-half">
                    <label className="form-label">Cantidad a Dar de Baja *</label>
                    <input
                      type="number"
                      name="quantity"
                      min="1"
                      required
                      placeholder="Ej: 5"
                      className="form-input"
                    />
                  </div>

                  <div className="form-field-half">
                    <label className="form-label">Método de Disposición Final *</label>
                    <select name="disposal_method" required className="form-select">
                      <option value="Inactivación química y entrega a gestor de residuos peligrosos">
                        Inactivación química + Gestor ambiental autorizado
                      </option>
                      <option value="Autoclave y descarte biológico">
                        Esterilización en Autoclave (Biológico)
                      </option>
                      <option value="Incineración externa certificada">
                        Incineración externa certificada
                      </option>
                      <option value="Devolución al proveedor / Recall técnico">
                        Devolución / Retiro de Mercado por Proveedor (Recall)
                      </option>
                      <option value="Derrame accidental / Rotura de frasco">
                        Neutralización de derrame / Frasco quebrado
                      </option>
                    </select>
                  </div>

                  <div className="form-field-full">
                    <label className="form-label">Motivo Detallado y Justificación Técnica *</label>
                    <textarea
                      name="reason"
                      required
                      rows={3}
                      placeholder="Explique la causa de la baja (ej: Lote vencido sin rotación, frasco contaminado con turbidez, control de calidad fallido...)"
                      className="form-textarea"
                    />
                  </div>
                </div>

                <div className="form-actions-center" style={{ marginTop: '1.5rem' }}>
                  <button
                    type="submit"
                    style={{
                      padding: '0.75rem 1.75rem',
                      borderRadius: '8px',
                      backgroundColor: '#dc2626',
                      color: '#ffffff',
                      border: 'none',
                      fontWeight: 700,
                      fontSize: '0.925rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      boxShadow: 'var(--shadow-md)',
                    }}
                  >
                      <Trash2 className="ui-icon" aria-hidden="true" /> Procesar Baja y Disposición Final
                  </button>
                </div>
              </form>
            </div>
          </CollapsibleSection>
        )}

        {/* ====== MOVIMIENTOS (KARDEX) ====== */}
        {currentView === 'movimientos' && (
          <div className="data-card">
            <div className="card-section-header">
              <div>
                <h2 className="card-section-title">Kardex (Historial de Movimientos)</h2>
                <p className="card-section-subtitle">Registro auditable de todas las entradas, salidas y ajustes de inventario.</p>
              </div>
              <ExportCSVButton
                filename="Kardex_Movimientos"
                data={(allMovements || []).map((row: StockMovement) => ({
                  'Fecha': new Date(row.created_at).toLocaleString(),
                  'Tipo': movementLabel(row.movement_type),
                  'Producto': row.batch?.item?.technical_name || 'Desconocido',
                  'Código': row.batch?.item?.internal_code || 'N/A',
                  'Lote': row.batch?.batch_number || 'N/A',
                  'Vencimiento': row.batch?.expiration_date ? new Date(row.batch.expiration_date).toLocaleDateString() : 'N/A',
                  'Impacto': (row.movement_type === 'entry' ? '+' : '-') + (row.quantity || 0),
                  'Responsable': getUserDisplayName(row.users),
                  'Motivo': row.reason || null
                }))}
              />
            </div>
            <div className="table-responsive">
              <table className="kardex-table">
                <thead>
                  <tr>
                    <th>Fecha y Hora</th>
                    <th>Tipo</th>
                    <th>Producto</th>
                    <th>Lote / Vencimiento</th>
                    <th style={{ textAlign: 'center' }}>Cantidad</th>
                    <th>Usuario / Notas</th>
                    <th style={{ textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {allMovements?.map((m: StockMovement) => (
                    <tr key={m.id}>
                      <td>
                        <span className="kardex-date">{new Date(m.created_at).toLocaleDateString()}</span>
                        <br />
                        <span className="kardex-time">{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </td>
                      <td>
                        <span className={movementBadgeClass(m.movement_type)}>
                          {movementLabel(m.movement_type)}
                        </span>
                      </td>
                      <td>
                        <div className="cell-primary">{m.batch?.item?.technical_name || 'Desconocido'}</div>
                        <div className="cell-muted">{m.batch?.item?.internal_code || 'N/A'}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{m.batch?.batch_number}</div>
                        <div className="kardex-expiry">
                          Vence: {m.batch && 'expiration_date' in m.batch && m.batch.expiration_date
                            ? new Date(m.batch.expiration_date).toLocaleDateString()
                            : 'N/A'}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={movementQtyClass(m.movement_type)}>
                          {m.movement_type === 'entry' ? '+' : '-'}{m.quantity}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{getUserDisplayName(m.users)}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          <span className="cell-muted" style={{ fontStyle: 'italic' }}>{m.reason}</span>
                          {m.equipment_name && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 700 }}>
                              Equipo: {m.equipment_name}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {m.batch?.id && (
                          <a
                            href={`/dashboard/seguridad/reportar/${m.batch.id}`}
                            title="Reportar Incidente de Calidad / Recall"
                            className="action-btn-report"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                              <path d="M12 9v4"/><path d="M12 17h.01"/>
                            </svg>
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                  {(!allMovements || allMovements.length === 0) && (
                    <tr>
                      <td colSpan={7} className="empty-state">
                        <p className="empty-state-text">No hay movimientos registrados en el historial.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

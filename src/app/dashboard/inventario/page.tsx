import { redirect } from "next/navigation";
import { CatalogService } from "@/lib/services/catalog";
import { StockService } from "@/lib/services/stock";
import { getCurrentUserProfile } from "@/lib/services/user";
import DeleteMasterButton from "@/components/DeleteMasterButton";
import InventoryProductSelector from "@/components/InventoryProductSelector";
import ProductTechnicalFields from "@/components/ProductTechnicalFields";
import ExportCSVButton from "@/components/ExportCSVButton";
import RealtimeStockTable from "./RealtimeStockTable";
import ContextualHelp from "@/components/ContextualHelp";
import * as Actions from "./actions";
import CollapsibleSection from "@/components/CollapsibleSection";
import ClinicalOutputForm from "@/components/ClinicalOutputForm";
import InventoryDispositionForm from "@/components/InventoryDispositionForm";
import { getExpirationSemaforo } from "@/lib/expiration-semaforo";
import { parseUnitsFromPresentation } from "@/lib/utils/presentation";
import { getDispositionCauseLabel, getDisposalRouteLabel } from "@/lib/disposal-options";
import { AlertTriangle, ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, Boxes, ClipboardList, FileText, History, Package, PackagePlus, PackageX, Trash2, X } from "lucide-react";

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
  section_id?: string | null;
  supplier_id?: string | null;
  commercial_name?: string | null;
  purchase_unit?: string | null;
  minimum_stock_threshold?: number | null;
  maximum_stock_threshold?: number | null;
  estimated_unit_price?: number | null;
  sections?: { name: string } | null;
  is_active?: boolean;
  sanitary_registration?: string | null;
  product_type?: 'medicamento' | 'dispositivo_medico' | 'reactivo' | 'insumo' | null;
  series?: string | null;
  brand?: string | null;
  product_description?: string | null;
  active_ingredient?: string | null;
  dosage_form?: string | null;
  concentration?: string | null;
  commercial_presentation?: string | null;
  shelf_life?: string | null;
  risk_classification?: 'I' | 'II' | 'IIA' | 'IIB' | 'III' | 'not_applicable';
}

interface Batch {
  id: string;
  item_id: string;
  batch_number: string;
  expiration_date: string;
  adjusted_expiration_date?: string | null;
  current_stock: number;
  opened_units_remaining?: number;
  opened_units_per_package?: number;
  location_id?: string | null;
  item?: CatalogItem | null;
  catalog_items?: CatalogItem | null;
  location?: { name: string; section_id?: string | null } | null;
  locations?: { name: string } | null;
  unit_cost?: number;
  clinical_status?: 'accepted' | 'quarantine' | 'rejected' | string;
  status?: string | null;
}

interface StockMovement {
  id: string;
  movement_type: string;
  created_at: string;
  quantity: number;
  reason?: string | null;
  disposition_cause?: string | null;
  disposal_route?: string | null;
  batch?: Batch | null;
  batches?: Batch | null;
  user_id?: string | null;
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
  if (type === 'discard') return 'Baja / Disposición';
  if (type === 'adjustment') return 'Ajuste';
  return 'Descarte';
}

function movementBadgeClass(type: string) {
  if (type === 'entry') return 'movement-badge movement-badge-entry';
  if (type === 'exit') return 'movement-badge movement-badge-exit';
  if (type === 'discard') return 'movement-badge movement-badge-discard';
  return 'movement-badge movement-badge-adjust';
}

function movementQtyClass(type: string) {
  if (type === 'entry') return 'qty-entry';
  if (type === 'exit' || type === 'discard') return 'qty-exit';
  return 'qty-adjust';
}

export default async function InventarioPage({
  searchParams,
}: {
  searchParams: Promise<{ editId?: string; view?: string; error?: string; from?: string; to?: string; user?: string; product?: string; location?: string; movementType?: string }>;
}) {
  const { editId, view, error, from, to, user: userFilter, product, location, movementType } = await searchParams;
  const user = await getCurrentUserProfile();
  if (!user) redirect("/auth/login");
  const canManageDisposal = user.role === "admin" || user.role === "supervisor";

  const [
    { data: catalogItems },
    { data: sections },
    { data: suppliers },
    { data: locations },
    { data: allBatches },
    { data: allMovements },
    { data: fractionalMovements }
  ] = await Promise.all([
    CatalogService.getCatalogItems(),
    CatalogService.getSections(),
    CatalogService.getSuppliers(),
    CatalogService.getLocations(),
    StockService.getAllBatches(),
    StockService.getAllMovements(),
    StockService.getAllFractionalMovements(),
  ]);

  const combinedMovements = [
    ...(allMovements || []).filter((movement: StockMovement) => !movement.reason?.includes("[FRACCIONAL_PACKAGE_OPEN]")),
    ...(fractionalMovements || []).map((movement: { id: string; batch_id: string; user_id: string; units_withdrawn: number; units_per_package: number; packages_opened: number; reason: string; movement_type?: string; disposition_cause?: string | null; disposal_route?: string | null; equipment_name?: string | null; created_at: string; batch?: StockMovement["batch"]; user?: AuditUser | null }) => ({
      id: `fractional-${movement.id}`,
      movement_type: movement.movement_type || "exit",
      created_at: movement.created_at,
      quantity: movement.units_withdrawn,
      reason: `${movement.reason} (${movement.movement_type === "discard" ? "baja" : "salida"} fraccionada: ${movement.units_withdrawn} de ${movement.units_per_package} unidades internas${movement.packages_opened ? `; se abrieron ${movement.packages_opened} empaque(s)` : ""})`,
      disposition_cause: movement.disposition_cause,
      disposal_route: movement.disposal_route,
      batch: movement.batch,
      user_id: movement.user_id,
      users: movement.user,
      equipment_name: movement.equipment_name,
    }))
  ].sort((a, b) => b.created_at.localeCompare(a.created_at));

  const editingItem = editId ? catalogItems?.find(i => i.id === editId) : null;
  const sectionOrder = ["hematologia", "microbiologia", "quimica", "especiales", "sede norte", "inmunologia", "inmunologia manual", "insumos", "medicamentos", "repuestos", "riqas", "glicosiladas", "dispositivos medicos", "colorantes", "aseo", "especiales 2"];
  const normalizeSectionName = (name: string) => name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
  const activeSections = (sections || []).filter((section: { is_active?: boolean }) => section.is_active !== false)
    .sort((a: { name: string }, b: { name: string }) => {
      const aIndex = sectionOrder.indexOf(normalizeSectionName(a.name));
      const bIndex = sectionOrder.indexOf(normalizeSectionName(b.name));
      return (aIndex < 0 ? Number.MAX_SAFE_INTEGER : aIndex) - (bIndex < 0 ? Number.MAX_SAFE_INTEGER : bIndex);
    });
  const manualEntrySections = activeSections.filter((section: { name: string }) =>
    sectionOrder.includes(normalizeSectionName(section.name))
  );
  const northLocations = (locations || []).filter((location: { is_active?: boolean; name: string }) =>
    location.is_active !== false && location.name.trim().toLocaleLowerCase() === "sede norte"
  );

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

  const inventoryViews = ["entradas", "stock", "salidas", "bajas", "traslados", "movimientos"];
  const requestedView = view || "entradas";
  const currentView = inventoryViews.includes(requestedView) ? requestedView : "entradas";
  const filteredMovements = combinedMovements.filter((movement: StockMovement) => {
    const movementDate = movement.created_at.slice(0, 10);
    return (!from || movementDate >= from)
      && (!to || movementDate <= to)
      && (!userFilter || movement.user_id === userFilter)
      && (!product || movement.batch?.item_id === product)
      && (!location || movement.batch?.location_id === location)
      && (!movementType || movement.movement_type === movementType);
  });
  const movementUsers = Array.from(new Map(combinedMovements
    .filter((movement: StockMovement) => movement.user_id)
    .map((movement: StockMovement) => [movement.user_id!, getUserDisplayName(movement.users)])).entries());
  const activeBatches = (allBatches || []).filter((batch: Batch) => batch.current_stock > 0 || (batch.opened_units_remaining || 0) > 0);
  const expirationStatus = (batch: Batch) => getExpirationSemaforo(
    batch.adjusted_expiration_date || batch.expiration_date,
    batch.status,
    batch.clinical_status,
  );
  const expiredBatchCount = activeBatches.filter((batch: Batch) => expirationStatus(batch).state === "expired").length;
  const nearExpiryBatchCount = activeBatches.filter((batch: Batch) => expirationStatus(batch).state === "near_expiry").length;
  const validBatchCount = activeBatches.filter((batch: Batch) => expirationStatus(batch).state === "valid").length;
  const quarantineBatchCount = activeBatches.filter((batch: Batch) => batch.clinical_status === 'quarantine').length;

  const productIdsWithStock = new Set(allBatches?.map((b: Batch) => b.item_id) || []);
  const catalogWithEntries = catalogItems?.filter((item: CatalogItem) => productIdsWithStock.has(item.id)) || [];

  const consolidatedStock = catalogItems?.map((item: CatalogItem) => {
    const itemBatches = allBatches?.filter((b: Batch) => b.item_id === item.id) || [];
    const usableBatches = itemBatches.filter((b: Batch) =>
      b.clinical_status === 'accepted'
      && expirationStatus(b).state !== "expired"
    );
    const totalStock = usableBatches.reduce((acc: number, b: Batch) => {
      const innerUnits = parseUnitsFromPresentation(item.commercial_presentation);
      return acc + (b.current_stock || 0) + (innerUnits ? (b.opened_units_remaining || 0) / innerUnits : 0);
    }, 0);
    return { ...item, itemBatches, totalStock };
  }).filter((item: CatalogItem & { totalStock: number, itemBatches: Batch[] }) =>
    item.totalStock > 0 || (item.itemBatches && item.itemBatches.length > 0)
  ).sort((a, b) => a.technical_name.localeCompare(b.technical_name)) || [];

  return (
    <div className="dashboard-main inventory-page">
      <div className="welcome-section">
        <h1 className="page-header-title">Gestión de Inventario</h1>
        <p>Control de entradas, salidas, bajas y existencias del laboratorio.</p>
      </div>

      <section className="inventory-metrics" aria-label="Resumen de lotes activos">
        <article className="inventory-metric inventory-metric-expired">
          <span className="inventory-metric-label">Vencidos</span>
          <strong>{expiredBatchCount} lotes</strong>
          <span className="inventory-metric-note">No aptos para uso</span>
        </article>
        <article className="inventory-metric inventory-metric-critical">
          <span className="inventory-metric-label">Próximos a vencer</span>
          <strong>{nearExpiryBatchCount} lotes</strong>
          <span className="inventory-metric-note">Vencen entre 1 y 30 días</span>
        </article>
        <article className="inventory-metric inventory-metric-success">
          <span className="inventory-metric-label">Lotes vigentes</span>
          <strong>{validBatchCount} lotes</strong>
          <span className="inventory-metric-note">Más de 30 días de vigencia</span>
        </article>
        <article className="inventory-metric inventory-metric-neutral">
          <span className="inventory-metric-label">En cuarentena</span>
          <strong>{quarantineBatchCount} lotes</strong>
          <span className="inventory-metric-note">Pendientes de liberación técnica</span>
        </article>
      </section>

      {/* Tab Navigation */}
      <nav className="tabs-nav inventory-tabs-nav" aria-label="Secciones de inventario">
        {[
          { key: 'entradas', label: 'Entrada manual', icon: <PackagePlus className="ui-icon" aria-hidden="true" /> },
          { key: 'stock', label: 'Stock', icon: <Boxes className="ui-icon" aria-hidden="true" /> },
          { key: 'salidas', label: 'Salidas', icon: <ArrowUpFromLine className="ui-icon" aria-hidden="true" /> },
          ...(canManageDisposal ? [{ key: 'bajas', label: 'Bajas', icon: <PackageX className="ui-icon" aria-hidden="true" /> }] : []),
          { key: 'traslados', label: 'Traslados', icon: <ArrowLeftRight className="ui-icon" aria-hidden="true" /> },
          { key: 'movimientos', label: 'Trazabilidad', icon: <History className="ui-icon" aria-hidden="true" /> },
        ].map(tab => (
          <a
            key={tab.key}
            href={`?view=${tab.key}`}
            className={`tab-link ${currentView === tab.key ? 'tab-link-active' : ''}`}
            aria-current={currentView === tab.key ? 'page' : undefined}
          >
            {tab.icon}
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
              title="Registro manual de producto y existencias"
              subtitle="Usa esta opción para altas no asociadas a un pedido. Las compras a proveedores se registran desde Pedidos y Recepción Técnica."
              icon={<Package className="ui-icon" aria-hidden="true" />}
              className="inventory-register-section"
            >
              <div className="form-card">
                <div className="form-card-header">
                  <h2 className="form-card-title">
                    {editingItem ? "Editar Producto" : "Datos del producto"}
                  </h2>
                  {editingItem && (
                    <a href="?view=entradas" style={{ fontSize: 'var(--fs-base)', color: 'var(--error)', textDecoration: 'none' }}>
                      Cancelar Edición
                    </a>
                  )}
                </div>

                <InventoryProductSelector products={catalogItems || []} currentId={editId} />

                <form key={editId || 'new'} action={Actions.handleCatalogAction} className="form-card-body">
                  <input type="hidden" name="id" value={editingItem?.id || ""} />

                  <div className="inventory-product-form-grid">
                    {/* Master / Technical */}
                    <div className={`inventory-basic-section ${editingItem ? 'form-section-readonly' : 'form-section'}`}>
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
                              <label className="form-label">Producto</label>
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

                        <ProductTechnicalFields
                          initial={editingItem as CatalogItem | null}
                          suppliers={suppliers || []}
                          batchNumber={latestBatch?.batch_number || ""}
                          expirationDate={latestBatch?.expiration_date ? new Date(latestBatch.expiration_date).toISOString().split('T')[0] : ""}
                          supplierId={latestBatch?.supplier_id || editingItem?.supplier_id || ""}
                        />

                        <div>
                          <label className="form-label">Área</label>
                          {editingItem ? (
                            <div className="form-readonly-field">
                              {sections?.find(s => s.id === editingItem.section_id)?.name || "Sin área"}
                              <input type="hidden" name="section_id" value={editingItem.section_id || ""} />
                            </div>
                          ) : (
                            <select name="section_id" required className="form-select">
                              <option value="">Seleccione un área...</option>
                              {manualEntrySections.map((s: { id: string; name: string }) => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                          )}
                        </div>
                        <div className="form-grid-2">
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}><label className="form-label" htmlFor="inventory-min-stock">Stock mínimo</label><ContextualHelp content="Umbral de reposición en unidades de compra. Si el stock utilizable queda por debajo, el panel genera una alerta. Un valor de cero no oculta una alerta por stock utilizable igual a cero y no bloquea ni habilita salidas." /></div>
                            <input id="inventory-min-stock" className="form-input" type="number" min="0" step="1" name="minimum_stock_threshold" defaultValue={editingItem?.minimum_stock_threshold || 0} />
                          </div>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}><label className="form-label" htmlFor="inventory-max-stock">Stock máximo (opcional)</label><ContextualHelp content="Umbral superior de referencia para señalar existencias por encima del nivel deseado. Déjalo vacío si no se controla máximo." /></div>
                            <input id="inventory-max-stock" className="form-input" type="number" min="0" step="1" name="maximum_stock_threshold" defaultValue={editingItem?.maximum_stock_threshold ?? ""} />
                          </div>
                        </div>
                        <div><label className="form-label">Precio unitario estimado ($)</label><input className="form-input" type="number" min="0" step="0.01" name="estimated_unit_price" defaultValue={editingItem?.estimated_unit_price || 0} /></div>
                      </div>
                    </div>

                    {/* Purchase / Stock Entry */}
                    <div className="form-section inventory-stock-section">
                      <div className="form-section-header">
                        <h3 className="form-section-title"><ArrowDownToLine className="ui-icon" aria-hidden="true" /> Registro</h3>
                        <ContextualHelp
                          content={{
                            title: "Registro de existencias",
                            description: "Registra lotes y existencias de productos del catálogo. Las compras a proveedores se gestionan desde Pedidos y se ingresan mediante Recepción Técnica.",
                            tips: ["Para compras, complete la recepción técnica del pedido para conservar la trazabilidad de factura, lote y vencimiento."]
                          }}
                        />
                      </div>

                      <div className="form-fields">

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
                      {editingItem ? "Actualizar Producto" : "Registrar Producto e Inventario"}
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
                          <th>Área</th>
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
                            <td style={{ color: 'var(--primary)', fontWeight: 600 }}>{i.sections?.name}</td>
                            <td>{i.purchase_unit}</td>
                            <td style={{ fontWeight: 600 }}>{i.minimum_stock_threshold}</td>
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
                  'Área': row.sections?.name || 'Sin área',
                  'Stock Total': row.totalStock,
                  'Unidad de medida': row.purchase_unit || 'N/A',
                  'Stock Máximo': row.maximum_stock_threshold ?? 'Sin definir',
                  'Lotes Disponibles': row.itemBatches?.filter((b: Batch) => b.current_stock > 0 || (b.opened_units_remaining || 0) > 0).map((b: Batch) => `${b.batch_number}:${b.current_stock} empaques${(b.opened_units_remaining || 0) > 0 ? ` + ${b.opened_units_remaining} unidades abiertas` : ''}`).join(' | ') || 'Agotado',
                  'Estado': row.totalStock === 0 ? 'Agotado' : row.totalStock <= (row.minimum_stock_threshold || 10) ? 'Stock Bajo' : 'Óptimo'
                }))}
              />
            </div>
            <RealtimeStockTable
              initialBatches={allBatches || []}
              sections={activeSections.map((section: { id: string; name: string }) => section)}
              catalogItems={catalogItems || []}
              suppliers={suppliers || []}
              movements={combinedMovements}
            />
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
              <ClinicalOutputForm batches={allBatches || []} sections={activeSections.map((section: { id: string; name: string }) => section)} action={Actions.handleConsumeAction} />
            </div>
          </CollapsibleSection>
        )}

        {/* ====== BAJAS Y DISPOSICIÓN FINAL ====== */}
        {currentView === 'bajas' && (
          canManageDisposal ? <CollapsibleSection
            title="Bajas y disposición final"
            subtitle="Retira existencias vencidas, dañadas o no aptas con motivo documentado y trazabilidad por lote."
            icon={<Trash2 className="ui-icon" aria-hidden="true" />}
          >
            <div className="form-card">
              <div className="form-card-header">
                <div>
                  <h2 className="form-card-title">Registrar baja de inventario</h2>
                  <p className="form-card-subtitle">Elige el lote, indica empaques completos y unidades remanentes abiertas, y documenta la causa y disposición.</p>
                </div>
              </div>
              <div className="form-card-body">
                {(allBatches || []).some((batch: Batch) => batch.current_stock > 0 || (batch.opened_units_remaining || 0) > 0) ? (
                  <InventoryDispositionForm
                    batches={(allBatches || []).filter((batch: Batch) => batch.current_stock > 0 || (batch.opened_units_remaining || 0) > 0)}
                    action={Actions.handleDiscardAction}
                  />
                ) : (
                  <div className="empty-state">
                    <div className="empty-state-icon"><PackageX className="ui-icon" aria-hidden="true" /></div>
                    <p className="empty-state-title">No hay existencias para dar de baja</p>
                    <p className="empty-state-text">Los lotes sin saldo no aparecen en este formulario.</p>
                  </div>
                )}
              </div>
            </div>
          </CollapsibleSection> : <div className="error-message" role="alert">Solo administradores y supervisores pueden registrar bajas y disposiciones finales. Solicita apoyo a un responsable autorizado.</div>
        )}

        {/* ====== TRASLADOS INTERNOS ====== */}
        {currentView === 'traslados' && (
          <CollapsibleSection
            title="Traslado entre ubicaciones"
            subtitle="Traslade existencias a Sede Norte con trazabilidad del área y lote de origen."
            icon={<ArrowLeftRight className="ui-icon" aria-hidden="true" />}
          >
            <div className="form-card">
              <div className="form-card-header">
                <div>
                  <h2 className="form-card-title">Formulario de Reubicación / Traslado</h2>
                  <p className="form-card-subtitle">
                    Seleccione el producto y la ubicación de origen. El lote se conserva durante el traslado y el stock se actualiza en ambas ubicaciones.
                  </p>
                </div>
              </div>

              <form action={Actions.handleTransferAction} className="form-body">
                <div className="form-grid">
                  <div className="form-field-full">
                    <label className="form-label">Producto a trasladar *</label>
                    <select name="batch_id" required className="form-select">
                      <option value="">-- Seleccione producto y ubicación de origen --</option>
                      {(allBatches || [])
                        .filter((b: Batch) => b.current_stock > 0)
                        .map((b: Batch) => (
                          <option key={b.id} value={b.id}>
                            {b.item?.technical_name || b.catalog_items?.technical_name} | {b.item?.commercial_presentation || b.catalog_items?.commercial_presentation || "No aplica"} | Stock: {b.current_stock} {b.item?.purchase_unit || b.catalog_items?.purchase_unit || "empaques"}{(b.opened_units_remaining || 0) > 0 ? ` + ${b.opened_units_remaining} unidades abiertas` : ""} | Ubicación: {b.location?.name || b.locations?.name || "Sin asignar"} | Vence: {new Date(b.expiration_date).toLocaleDateString("es-CO")}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="form-field-half">
                    <label className="form-label">Ubicación de destino *</label>
                    <select name="destination_location_id" required className="form-select">
                      <option value="">-- Seleccione Sede Norte --</option>
                      {northLocations.map((loc: { id: string; name: string; location_type?: string }) => (
                          <option key={loc.id} value={loc.id}>
                            {loc.name}
                          </option>
                        ))}
                    </select>
                    {northLocations.length === 0 && <p className="cell-secondary">Configure primero la ubicación Sede Norte desde los maestros.</p>}
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
                      placeholder="Motivo del traslado a Sede Norte"
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="form-actions-center" style={{ marginTop: '1.5rem' }}>
                  <button
                    type="submit"
                    style={{ padding: '0.75rem 2rem', borderRadius: '8px', backgroundColor: 'var(--navy)', color: '#ffffff', border: 'none', fontWeight: 600, fontSize: 'var(--fs-base)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', boxShadow: 'var(--shadow-md)' }}
                  >
                    <ArrowLeftRight className="ui-icon" aria-hidden="true" /> Confirmar Traslado de Inventario
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
                <h2 className="card-section-title">Trazabilidad de movimientos</h2>
                <p className="card-section-subtitle">Registro auditable de todas las entradas, salidas y ajustes de inventario.</p>
              </div>
              <ExportCSVButton
                filename="Trazabilidad_Movimientos"
                data={filteredMovements.map((row: StockMovement) => ({
                  'Fecha': new Date(row.created_at).toLocaleString(),
                  'Tipo': movementLabel(row.movement_type),
                  'Producto': row.batch?.item?.technical_name || 'Desconocido',
                  'Código': row.batch?.item?.internal_code || 'N/A',
                  'Lote': row.batch?.batch_number || 'N/A',
                  'Vencimiento': row.batch?.expiration_date ? new Date(row.batch.expiration_date).toLocaleDateString() : 'N/A',
                  'Impacto': (row.movement_type === 'entry' ? '+' : '-') + (row.quantity || 0),
                  'Responsable': getUserDisplayName(row.users),
                  'Causa de baja': row.disposition_cause ? getDispositionCauseLabel(row.disposition_cause) : null,
                  'Método de disposición': row.disposal_route ? getDisposalRouteLabel(row.disposal_route) : null,
                  'Motivo': row.reason || null
                }))}
              />
            </div>
            <form method="get" className="inventory-movement-filters">
              <input type="hidden" name="view" value="movimientos" />
              <div><label className="form-label" htmlFor="movement-from">Desde</label><input id="movement-from" className="form-input" type="date" name="from" defaultValue={from || ''} /></div>
              <div><label className="form-label" htmlFor="movement-to">Hasta</label><input id="movement-to" className="form-input" type="date" name="to" defaultValue={to || ''} /></div>
              <div><label className="form-label" htmlFor="movement-product">Producto</label><select id="movement-product" className="form-select" name="product" defaultValue={product || ''}><option value="">Todos</option>{catalogItems?.map(item => <option key={item.id} value={item.id}>{item.technical_name}</option>)}</select></div>
              <div><label className="form-label" htmlFor="movement-location">Ubicación</label><select id="movement-location" className="form-select" name="location" defaultValue={location || ''}><option value="">Todas</option>{locations?.map((loc: { id: string; name: string }) => <option key={loc.id} value={loc.id}>{loc.name}</option>)}</select></div>
              <div><label className="form-label" htmlFor="movement-user">Usuario</label><select id="movement-user" className="form-select" name="user" defaultValue={userFilter || ''}><option value="">Todos</option>{movementUsers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></div>
              <div><label className="form-label" htmlFor="movement-type">Tipo</label><select id="movement-type" className="form-select" name="movementType" defaultValue={movementType || ''}><option value="">Todos</option><option value="entry">Entrada</option><option value="exit">Salida</option><option value="adjustment">Ajuste</option><option value="discard">Baja / Disposición</option></select></div>
              <div className="inventory-filter-actions">
                <button type="submit" className="btn-primary">Filtrar movimientos</button>
                <a href="?view=movimientos" className="btn-secondary" style={{ textAlign: 'center', textDecoration: 'none' }}>Limpiar filtros</a>
              </div>
            </form>
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
                  {filteredMovements.map((m: StockMovement) => (
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
                        {m.batch?.expiration_date ? (() => {
                          const expiryDate = m.batch.adjusted_expiration_date || m.batch.expiration_date;
                          const semaforo = getExpirationSemaforo(expiryDate, m.batch.status, m.batch.clinical_status);
                          return (
                            <div className="kardex-expiry" style={{ color: semaforo.color }}>
                              {semaforo.label}: {new Date(expiryDate).toLocaleDateString()}
                            </div>
                          );
                        })() : <div className="kardex-expiry">N/A</div>}
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
                          {m.movement_type === 'discard' && (
                            <span className="cell-muted">
                              Causa: {getDispositionCauseLabel(m.disposition_cause)} · Disposición: {getDisposalRouteLabel(m.disposal_route)}
                            </span>
                          )}
                          {m.equipment_name && (
                            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--primary)', fontWeight: 600 }}>
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
                  {filteredMovements.length === 0 && (
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

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
    CatalogService.getCategories(),
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
        <h1>Gestión de Inventario</h1>
        <p>Control de entradas, salidas y existencias del laboratorio.</p>
      </div>

      {/* Tab Navigation */}
      <nav className="tabs-nav">
        {[
          { key: 'entradas',    label: 'Entrada de Productos' },
          { key: 'stock',       label: 'Stock Actual' },
          { key: 'salidas',     label: 'Salida de Productos' },
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
            <span style={{ fontSize: '1.25rem' }}>⚠️</span>
            <div>
              <strong>Error al guardar:</strong> {decodeURIComponent(error)}
            </div>
            <a href="?view=entradas" className="alert-error-close">✕</a>
          </div>
        )}

        {/* ====== ENTRADAS ====== */}
        {currentView === 'entradas' && (
          <>
            <CollapsibleSection
              title="Nuevo Registro en Catálogo"
              subtitle="Defina los productos maestros que ingresarán al inventario."
              icon={<span>📦</span>}
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
                          {editingItem ? "📄 Ficha Técnica (Maestro)" : "Información Básica"}
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
                        <h3 className="form-section-title">📥 Registro de Compra / Entrada</h3>
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
              icon={<span>📋</span>}
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

        {/* ====== SALIDAS ====== */}
        {currentView === 'salidas' && (
          <CollapsibleSection
            title="Registrar Salida / Consumo"
            subtitle="Descuente stock del inventario para uso operativo o ajustes."
            icon={<span>📤</span>}
          >
            <div className="form-card">
              <form action={Actions.handleConsumeAction} className="form-card-body">
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 600px)', gap: '1.5rem', justifyContent: 'center' }}>
                  <div className="form-section">
                    <div className="form-fields">
                      <div>
                        <label className="form-label">Producto / Lote a Consumir *</label>
                        <select name="batch_id" required className="form-select">
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

                      <div className="form-grid-2">
                        <div>
                          <label className="form-label">Cantidad a Descontar *</label>
                          <input type="number" name="quantity" defaultValue="1" min="1" required className="form-input" />
                        </div>
                        <div>
                          <label className="form-label">Motivo / Justificación *</label>
                          <select name="reason" required className="form-select">
                            <option value="Consumo operativo">Consumo Operativo</option>
                            <option value="Descarte por vencimiento">Descarte por Vencimiento</option>
                            <option value="Ajuste por pérdida">Ajuste por Pérdida/Daño</option>
                            <option value="Calibración/Control">Uso en Calibración/Control</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="form-label">Analizador / Equipo Destino (Opcional - ISO 15189)</label>
                        <input
                          name="equipment"
                          placeholder="Ej: Cobas c311, Sysmex XN-1000..."
                          className="form-input"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="form-actions-center">
                  <button type="submit" className="btn-danger">Registrar Salida</button>
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
                              🔬 Equipo: {m.equipment_name}
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

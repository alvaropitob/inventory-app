"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDateKeyInBusinessTimeZone } from "@/lib/dates";
import { getExpirationSemaforo } from "@/lib/expiration-semaforo";
import { parseUnitsFromPresentation } from "@/lib/utils/presentation";

interface Batch {
  id: string;
  item_id: string;
  batch_number: string;
  expiration_date: string;
  adjusted_expiration_date?: string | null;
  current_stock: number;
  initial_quantity?: number;
  opened_units_remaining?: number;
  supplier_id?: string | null;
  location_id?: string | null;
  status?: string | null;
  clinical_status?: string | null;
  item?: { technical_name: string; commercial_name: string; internal_code: string; commercial_presentation?: string | null; minimum_stock_threshold?: number; maximum_stock_threshold?: number | null; section_id?: string; sections?: { name: string } | null } | null;
  location?: { name: string; section_id?: string | null } | null;
}

interface CatalogItem {
  id: string;
  internal_code: string;
  technical_name: string;
  commercial_name?: string | null;
  supplier_id?: string | null;
  product_type?: string | null;
  brand?: string | null;
  product_description?: string | null;
  series?: string | null;
  active_ingredient?: string | null;
  dosage_form?: string | null;
  concentration?: string | null;
  commercial_presentation?: string | null;
  purchase_unit?: string | null;
  sanitary_registration?: string | null;
  risk_classification?: string | null;
  shelf_life?: string | null;
  minimum_stock_threshold?: number | null;
  maximum_stock_threshold?: number | null;
  estimated_unit_price?: number | null;
  is_active?: boolean;
  sections?: { name: string } | { name: string }[] | null;
  suppliers?: { name: string } | { name: string }[] | null;
}

interface Supplier { id: string; name: string; }

interface Movement {
  id: string;
  movement_type: string;
  created_at: string;
  quantity: number;
  reason?: string | null;
  batch?: { item_id?: string; batch_number?: string; expiration_date?: string } | null;
  user?: { full_name: string | null; username: string | null } | null;
  users?: { full_name: string | null; username: string | null } | { full_name: string | null; username: string | null }[] | null;
}

interface GroupedItem {
  technical_name: string;
  commercial_name: string;
  internal_code: string;
  minimum_stock_threshold?: number;
  maximum_stock_threshold?: number | null;
  id: string;
  totalStock: number;
  itemBatches: Batch[];
}

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  medicamento: "Medicamento",
  dispositivo_medico: "Dispositivo médico",
  reactivo: "Reactivo",
  insumo: "Insumo",
};

export default function RealtimeStockTable({
  initialBatches,
  sections = [],
  catalogItems,
  suppliers,
  movements,
}: {
  initialBatches: Batch[];
  sections?: { id: string; name: string }[];
  catalogItems: CatalogItem[];
  suppliers: Supplier[];
  movements: Movement[];
}) {
  const [batches, setBatches] = useState(initialBatches);
  const [selectedSection, setSelectedSection] = useState("all");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const channel = supabase
      .channel('inventory_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inventory_batches' },
        (payload) => {
          console.log('Realtime change detected:', payload);
          // Refresh data or update local state
          // For simplicity and correctness (to get joined data), we can trigger a re-fetch or just update simple fields
          // A more robust way is to revalidate the server component, but for "live" feel, local state update is better.
          if (payload.eventType === 'UPDATE') {
            setBatches(current => 
              current.map(b => b.id === payload.new.id ? { ...b, ...payload.new } : b)
            );
          } else if (payload.eventType === 'INSERT') {
             // For inserts, we'd need to fetch the joined item/location data
             // To keep it simple for this demo, we'll just log and suggest a refresh or fetch the single item
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  // Grouping logic (simplified)
  const visibleBatches = selectedSection === "all" ? batches : batches.filter(batch =>
    batch.location?.section_id === selectedSection
  );
  const groupedStock = visibleBatches.reduce((acc: Record<string, GroupedItem>, batch) => {
    const itemId = batch.item_id;
    if (!acc[itemId]) {
      acc[itemId] = {
        technical_name: batch.item?.technical_name || '',
        commercial_name: batch.item?.commercial_name || '',
        internal_code: batch.item?.internal_code || '',
        minimum_stock_threshold: batch.item?.minimum_stock_threshold,
        id: itemId,
        maximum_stock_threshold: batch.item?.maximum_stock_threshold,
        totalStock: 0,
        itemBatches: []
      };
    }
    if (batch.clinical_status === "accepted" && (batch.current_stock > 0 || (batch.opened_units_remaining || 0) > 0) && getExpirationSemaforo(batch.adjusted_expiration_date || batch.expiration_date, batch.status, batch.clinical_status).state !== "expired") {
      const packageUnits = parseUnitsFromPresentation(batch.item?.commercial_presentation);
      acc[itemId].totalStock += batch.current_stock + (packageUnits ? (batch.opened_units_remaining || 0) / packageUnits : 0);
    }
    acc[itemId].itemBatches.push(batch);
    return acc;
  }, {});

  const sortedStock = Object.values(groupedStock).sort((a: GroupedItem, b: GroupedItem) => 
    (a.technical_name || '').localeCompare(b.technical_name || '')
  );
  const selectedProduct = catalogItems.find(product => product.id === selectedProductId) || null;
  const selectedProductBatches = selectedProduct ? batches
    .filter(batch => batch.item_id === selectedProduct.id)
    .sort((a, b) => (a.expiration_date || "").localeCompare(b.expiration_date || "")) : [];
  const selectedProductMovements = selectedProduct ? movements
    .filter(movement => movement.batch?.item_id === selectedProduct.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at)) : [];
  const getRelatedName = (value?: { name: string } | { name: string }[] | null) =>
    Array.isArray(value) ? value[0]?.name : value?.name;
  const displayValue = (value?: string | number | null) => value === null || value === undefined || value === "" ? "No registrado" : String(value);
  const displayProductType = (value?: string | null) =>
    value ? (PRODUCT_TYPE_LABELS[value] || value) : "No registrado";
  const displayRiskClassification = (value?: string | null) =>
    !value ? "No registrado" : value === "not_applicable" ? "No aplica" : value;
  const movementLabels: Record<string, string> = { entry: "Entrada", exit: "Salida", adjustment: "Ajuste", discard: "Baja / disposición" };
  const movementLabel = (type: string) => movementLabels[type] || type;
  const movementUserName = (movement: Movement) => {
    const user = Array.isArray(movement.users) ? movement.users[0] : movement.users || movement.user;
    return user?.full_name || user?.username || "Sistema";
  };

  return (
    <>
    <div className="table-responsive">
      <nav className="tabs-nav" aria-label="Filtrar stock por área" style={{ marginBottom: '1rem' }}>
        <button type="button" className={`tab-link ${selectedSection === "all" ? "tab-link-active" : ""}`} onClick={() => setSelectedSection("all")}>Todas las áreas</button>
        {sections.map(section => <button type="button" key={section.id} className={`tab-link ${selectedSection === section.id ? "tab-link-active" : ""}`} onClick={() => setSelectedSection(section.id)}>{section.name}</button>)}
      </nav>
      <table className="inventory-stock-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
            <th style={{ textAlign: 'left' }}>Código</th>
            <th style={{ textAlign: 'left' }}>Producto</th>
            <th style={{ textAlign: 'center' }}>Stock Total</th>
            <th style={{ textAlign: 'left' }}>Lote / Desglose</th>
            <th style={{ textAlign: 'center' }}>Estado</th>
            <th style={{ textAlign: 'center' }}>Ficha</th>
          </tr>
        </thead>
        <tbody>
          {sortedStock.map((item: GroupedItem) => {
            const isLowStock = item.totalStock <= (item.minimum_stock_threshold || 10);
            const isOutOfStock = item.totalStock === 0;
            const isOverStock = item.maximum_stock_threshold != null && item.totalStock > item.maximum_stock_threshold;
            
            return (
              <tr
                key={item.id}
                onDoubleClick={() => setSelectedProductId(item.id)}
                title="Doble clic para ver la ficha completa del producto"
                style={{ borderBottom: '1px solid var(--border)', background: isOutOfStock ? '#fff1f2' : 'transparent', cursor: 'pointer' }}
              >
                <td className="inventory-stock-code" style={{ color: 'var(--text-muted)' }}>{item.internal_code}</td>
                <td>
                  <div style={{ fontWeight: 600, color: 'var(--navy)', fontSize: 'var(--fs-base)' }}>{item.technical_name}</div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>{item.commercial_name}</div>
                </td>
                <td style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: 'var(--fs-lg)', fontWeight: 600, color: isOutOfStock || isOverStock ? 'var(--error)' : isLowStock ? 'var(--warning)' : 'var(--success)' }}>
                    {Number(item.totalStock.toFixed(2))}
                  </span>
                </td>
                <td>
                  {item.itemBatches.filter((b: Batch) => b.current_stock > 0 || (b.opened_units_remaining || 0) > 0).map((b: Batch) => (
                    <div key={b.id} className="inventory-stock-batch">
                      <div className="inventory-stock-batch-main">
                        <span className="inventory-stock-batch-number">{b.batch_number}</span>
                        <strong>{b.current_stock} empaques{(b.opened_units_remaining || 0) > 0 ? ` + ${b.opened_units_remaining} unidades abiertas` : ''}</strong>
                      </div>
                      <div className="inventory-stock-batch-meta">
                        <span>{b.location?.name || "Sin ubicación"}</span>
                        <span style={{ color: getExpirationSemaforo(b.adjusted_expiration_date || b.expiration_date, b.status, b.clinical_status).color, fontWeight: 600 }}>
                          {getExpirationSemaforo(b.adjusted_expiration_date || b.expiration_date, b.status, b.clinical_status).isExpired ? "VENCIDO" : "Vence"}: {new Date(b.adjusted_expiration_date || b.expiration_date).toLocaleDateString("es-CO")}
                        </span>
                      </div>
                    </div>
                  ))}
                </td>
                <td className="inventory-stock-status" style={{ textAlign: 'center' }}>
                    {isOutOfStock ? (
                      <span style={{ padding: '0.3rem 0.6rem', borderRadius: '12px', fontSize: 'var(--fs-xs)', fontWeight: 600, background: '#fee2e2', color: '#991b1b' }}>AGOTADO</span>
                    ) : isOverStock ? (
                      <span style={{ padding: '0.3rem 0.6rem', borderRadius: '12px', fontSize: 'var(--fs-xs)', fontWeight: 600, background: '#fee2e2', color: '#991b1b' }}>SOBRE MÁXIMO</span>
                    ) : isLowStock ? (
                      <span style={{ padding: '0.3rem 0.6rem', borderRadius: '12px', fontSize: 'var(--fs-xs)', fontWeight: 600, background: '#fef3c7', color: '#92400e' }}>BAJO</span>
                    ) : (
                      <span style={{ padding: '0.3rem 0.6rem', borderRadius: '12px', fontSize: 'var(--fs-xs)', fontWeight: 600, background: '#dcfce7', color: '#166534' }}>ÓPTIMO</span>
                    )}
                </td>
                <td style={{ textAlign: 'center' }}>
                  <button type="button" className="inventory-product-details-trigger" onClick={() => setSelectedProductId(item.id)} aria-label={`Ver ficha completa de ${item.technical_name}`}>
                    Ver ficha
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ padding: '0.5rem', fontSize: 'var(--fs-xs)', color: 'var(--success)', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.25rem' }}>
        <span style={{ width: '6px', height: '6px', background: 'var(--success)', borderRadius: '50%', display: 'inline-block' }}></span>
        Monitoreo en tiempo real activo
      </div>
    </div>
      {selectedProduct && (
        <div className="inventory-product-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setSelectedProductId(null); }}>
          <section className="inventory-product-dialog" role="dialog" aria-modal="true" aria-labelledby="inventory-product-dialog-title" onKeyDown={event => { if (event.key === "Escape") setSelectedProductId(null); }}>
            <header className="inventory-product-dialog-header">
              <div>
                <p className="inventory-product-dialog-eyebrow">Ficha de producto</p>
                <h2 id="inventory-product-dialog-title">{selectedProduct.technical_name}</h2>
                <p>{selectedProduct.internal_code}{selectedProduct.commercial_name ? ` · ${selectedProduct.commercial_name}` : ""}</p>
              </div>
              <div className="inventory-product-dialog-actions">
                <button type="button" className="btn-secondary" onClick={() => window.print()}>Imprimir ficha</button>
                <button type="button" autoFocus className="inventory-product-dialog-close" onClick={() => setSelectedProductId(null)} aria-label="Cerrar ficha">×</button>
              </div>
            </header>
            <div className="inventory-product-dialog-content">
              <section className="inventory-product-detail-section">
                <h3>Datos maestros</h3>
                <dl className="inventory-product-detail-grid">
                  <div><dt>Tipo de producto</dt><dd>{displayProductType(selectedProduct.product_type)}</dd></div>
                  <div><dt>Área</dt><dd>{displayValue(getRelatedName(selectedProduct.sections))}</dd></div>
                  <div><dt>Marca</dt><dd>{displayValue(selectedProduct.brand)}</dd></div>
                  <div><dt>Serie</dt><dd>{displayValue(selectedProduct.series)}</dd></div>
                  <div><dt>Descripción</dt><dd>{displayValue(selectedProduct.product_description)}</dd></div>
                  <div><dt>Principio activo</dt><dd>{displayValue(selectedProduct.active_ingredient)}</dd></div>
                  <div><dt>Forma farmacéutica</dt><dd>{displayValue(selectedProduct.dosage_form)}</dd></div>
                  <div><dt>Concentración</dt><dd>{displayValue(selectedProduct.concentration)}</dd></div>
                  <div><dt>Presentación comercial</dt><dd>{displayValue(selectedProduct.commercial_presentation)}</dd></div>
                  <div><dt>Unidad de compra</dt><dd>{displayValue(selectedProduct.purchase_unit)}</dd></div>
                  <div><dt>Registro INVIMA</dt><dd>{displayValue(selectedProduct.sanitary_registration)}</dd></div>
                  <div><dt>Clasificación de riesgo</dt><dd>{displayRiskClassification(selectedProduct.risk_classification)}</dd></div>
                  <div><dt>Vida útil</dt><dd>{displayValue(selectedProduct.shelf_life)}</dd></div>
                  <div><dt>Proveedor maestro</dt><dd>{displayValue(getRelatedName(selectedProduct.suppliers) || suppliers.find(s => s.id === selectedProduct.supplier_id)?.name)}</dd></div>
                  <div><dt>Stock mínimo</dt><dd>{displayValue(selectedProduct.minimum_stock_threshold)}</dd></div>
                  <div><dt>Stock máximo</dt><dd>{displayValue(selectedProduct.maximum_stock_threshold)}</dd></div>
                  <div><dt>Precio estimado</dt><dd>{selectedProduct.estimated_unit_price == null ? "No registrado" : `$ ${selectedProduct.estimated_unit_price.toLocaleString("es-CO")}`}</dd></div>
                  <div><dt>Estado del producto</dt><dd>{selectedProduct.is_active === false ? "Inactivo" : "Activo"}</dd></div>
                </dl>
              </section>

              <section className="inventory-product-detail-section">
                <h3>Lotes ({selectedProductBatches.length})</h3>
                {selectedProductBatches.length ? (
                  <div className="inventory-product-detail-table-wrap"><table className="inventory-product-detail-table">
                    <thead><tr><th>Lote</th><th>Vencimiento</th><th>Proveedor</th><th>Ubicación</th><th>Existencia inicial</th><th>Saldo actual</th><th>Estado</th></tr></thead>
                    <tbody>{selectedProductBatches.map(batch => {
                      const expiry = batch.adjusted_expiration_date || batch.expiration_date;
                      const expiryStatus = getExpirationSemaforo(expiry, batch.status, batch.clinical_status);
                      const supplierName = suppliers.find(supplier => supplier.id === batch.supplier_id)?.name;
                      return <tr key={batch.id}>
                        <td>{displayValue(batch.batch_number)}</td>
                        <td>{expiry ? formatDateKeyInBusinessTimeZone(expiry) : "No registrada"}</td>
                        <td>{displayValue(supplierName)}</td>
                        <td>{displayValue(batch.location?.name)}</td>
                        <td>{displayValue(batch.initial_quantity)} empaques</td>
                        <td>{batch.current_stock} empaques{(batch.opened_units_remaining || 0) > 0 ? ` + ${batch.opened_units_remaining} unidades abiertas` : ""}</td>
                        <td><span style={{ color: expiryStatus.color, fontWeight: 600 }}>{({ accepted: "Aceptado", quarantine: "En cuarentena", rejected: "Rechazado", expired: "Vencido" } as Record<string, string>)[batch.clinical_status || batch.status || ""] || displayValue(batch.clinical_status || batch.status)} · {expiryStatus.label}</span></td>
                      </tr>;
                    })}</tbody>
                  </table></div>
                ) : <p className="inventory-product-detail-empty">Este producto aún no tiene lotes registrados.</p>}
              </section>

              <section className="inventory-product-detail-section">
                <h3>Historial de movimientos ({selectedProductMovements.length})</h3>
                {selectedProductMovements.length ? (
                  <div className="inventory-product-detail-table-wrap"><table className="inventory-product-detail-table">
                    <thead><tr><th>Fecha</th><th>Movimiento</th><th>Lote</th><th>Cantidad</th><th>Usuario</th><th>Observación</th></tr></thead>
                    <tbody>{selectedProductMovements.map(movement => <tr key={movement.id}>
                      <td>{new Date(movement.created_at).toLocaleString("es-CO")}</td>
                      <td>{movementLabel(movement.movement_type)}</td>
                      <td>{displayValue(movement.batch?.batch_number)}</td>
                      <td>{movement.quantity}</td>
                      <td>{movementUserName(movement)}</td>
                      <td>{displayValue(movement.reason)}</td>
                    </tr>)}</tbody>
                  </table></div>
                ) : <p className="inventory-product-detail-empty">No hay movimientos registrados para este producto.</p>}
              </section>
              <p className="inventory-product-detail-footnote">Los datos de lote, vencimiento y movimientos corresponden a registros de inventario; la ficha maestra no los sustituye.</p>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

"use client";

import { useState } from "react";
import { formatDateKeyInBusinessTimeZone } from "@/lib/dates";
import { formatAmount } from "@/lib/formatters";
import { getExpirationSemaforo } from "@/lib/expiration-semaforo";
import DeleteMasterButton from "./DeleteMasterButton";

interface CatalogItem {
  id: string;
  internal_code: string;
  technical_name: string;
  commercial_name: string | null;
  section_id: string;
  purchase_unit: string | null;
  minimum_stock_threshold: number | null;
  maximum_stock_threshold?: number | null;
  estimated_unit_price: number | null;
  supplier_id?: string | null;
  product_type?: string | null;
  series?: string | null;
  brand?: string | null;
  product_description?: string | null;
  active_ingredient?: string | null;
  dosage_form?: string | null;
  concentration?: string | null;
  commercial_presentation?: string | null;
  sanitary_registration?: string | null;
  risk_classification?: string | null;
  shelf_life?: string | null;
  is_active: boolean;
  sections?: { name: string } | { name: string }[] | null;
  suppliers?: { name: string } | { name: string }[] | null;
}

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
  status?: string | null;
  clinical_status?: string | null;
  location?: { name: string } | null;
}

interface Supplier {
  id: string;
  name: string;
}

interface ProductMaintenanceListProps {
  initialItems: CatalogItem[];
  batches?: Batch[];
  suppliers?: Supplier[];
  toggleStatusAction: (id: string, currentStatus: boolean, type: 'product') => Promise<void>;
  handleDeleteAction: (id: string, type: 'product') => Promise<void>;
}

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  medicamento: "Medicamento",
  dispositivo_medico: "Dispositivo médico",
  reactivo: "Reactivo",
  insumo: "Insumo",
};

export default function ProductMaintenanceList({ 
  initialItems, 
  batches = [],
  suppliers = [],
  toggleStatusAction, 
  handleDeleteAction 
}: ProductMaintenanceListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  const displayItems = initialItems.filter(item => {
    const s = searchTerm.toLowerCase();
    return (
      item.technical_name.toLowerCase().includes(s) ||
      item.internal_code.toLowerCase().includes(s) ||
      (item.commercial_name && item.commercial_name.toLowerCase().includes(s))
    );
  });

  const selectedProduct = initialItems.find(item => item.id === selectedProductId) || null;
  const selectedProductBatches = selectedProduct
    ? batches
        .filter(batch => batch.item_id === selectedProduct.id)
        .sort((a, b) => (a.expiration_date || "").localeCompare(b.expiration_date || ""))
    : [];

  const getRelatedName = (value?: { name: string } | { name: string }[] | null) =>
    Array.isArray(value) ? value[0]?.name : value?.name;
  const displayValue = (value?: string | number | null) =>
    value === null || value === undefined || value === "" ? "No registrado" : String(value);
  const displayProductType = (value?: string | null) =>
    value ? (PRODUCT_TYPE_LABELS[value] || value) : "No registrado";
  const displayRiskClassification = (value?: string | null) =>
    !value ? "No registrado" : value === "not_applicable" ? "No aplica" : value;

  return (
    <>
      <div style={{ padding: '0 1.5rem 1.5rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
        <div className="form-group" style={{ maxWidth: '450px', position: 'relative' }}>
          <span style={{ position: 'absolute', left: '1rem', top: '1.4rem', color: 'var(--text-muted)', zIndex: 1 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          </span>
          <input 
            type="text" 
            placeholder="Buscar por nombre, código o presentación..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      
      <div className="table-responsive">
        <table className="table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Producto</th>
              <th>Presentación</th>
              <th style={{ textAlign: 'right' }}>P. Estimado</th>
              <th style={{ textAlign: 'center' }}>Estado</th>
              <th style={{ textAlign: 'center' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {displayItems.map(i => (
              <tr
                key={i.id}
                onDoubleClick={() => setSelectedProductId(i.id)}
                title="Doble clic para ver la ficha completa del producto"
                style={{ cursor: 'pointer' }}
              >
                <td style={{ color: 'var(--text-muted)' }}>{i.internal_code}</td>
                <td style={{ fontWeight: 600, color: 'var(--navy)' }}>{i.technical_name}</td>
                <td>{i.commercial_name || i.commercial_presentation || "-"}</td>
                <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--primary)' }}>
                  ${formatAmount(i.estimated_unit_price)}
                </td>
                <td style={{ textAlign: 'center' }}>
                  <span className={i.is_active ? 'badge badge-success' : 'badge badge-error'}>
                    {i.is_active ? 'ACTIVO' : 'INACTIVO'}
                  </span>
                </td>
                <td style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="inventory-product-details-trigger"
                      onClick={() => setSelectedProductId(i.id)}
                      aria-label={`Ver ficha completa de ${i.technical_name}`}
                    >
                      Ver ficha
                    </button>
                    <a href={`?tab=productos&editId=${i.id}`} className="btn-secondary">Editar</a>
                    <form action={async () => {
                      await toggleStatusAction(i.id, !!i.is_active, 'product');
                    }}>
                      <button type="submit" className="btn-secondary" style={{ color: i.is_active ? 'var(--error)' : 'var(--success)' }}>
                        {i.is_active ? 'Inactivar' : 'Activar'}
                      </button>
                    </form>
                    <DeleteMasterButton onDelete={async () => {
                      if (confirm(`¿Seguro quieres eliminar el producto "${i.technical_name}"?`)) {
                        await handleDeleteAction(i.id, 'product');
                      }
                    }} />
                  </div>
                </td>
              </tr>
            ))}
            {displayItems.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No se encontraron productos que coincidan con la búsqueda.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedProduct && (
        <div className="inventory-product-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setSelectedProductId(null); }}>
          <section className="inventory-product-dialog" role="dialog" aria-modal="true" aria-labelledby="config-product-dialog-title" onKeyDown={event => { if (event.key === "Escape") setSelectedProductId(null); }}>
            <header className="inventory-product-dialog-header">
              <div>
                <p className="inventory-product-dialog-eyebrow">Ficha de producto</p>
                <h2 id="config-product-dialog-title">{selectedProduct.technical_name}</h2>
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
              <p className="inventory-product-detail-footnote">Los datos de lote y vencimiento corresponden a registros de inventario; la ficha maestra no los sustituye.</p>
            </div>
          </section>
        </div>
      )}

      <style jsx>{`
        .hover-row:hover {
          background-color: var(--bg-app);
        }
      `}</style>
    </>
  );
}

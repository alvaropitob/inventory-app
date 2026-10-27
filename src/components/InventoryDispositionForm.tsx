"use client";

import { useEffect, useState, type FormEvent } from "react";
import { PackageX, ShieldAlert } from "lucide-react";
import { dispositionCauses, disposalRoutes } from "@/lib/disposal-options";

interface DispositionBatch {
  id: string;
  batch_number: string;
  expiration_date: string;
  adjusted_expiration_date?: string | null;
  current_stock: number;
  opened_units_remaining?: number;
  opened_units_per_package?: number;
  status?: string | null;
  clinical_status?: string | null;
  item?: {
    technical_name: string;
    internal_code: string;
    purchase_unit?: string | null;
    commercial_presentation?: string | null;
  } | null;
  catalog_items?: DispositionBatch["item"];
  location?: { name: string } | null;
  locations?: { name: string } | null;
}

function formatDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("es-CO");
}

export default function InventoryDispositionForm({ batches, action }: {
  batches: DispositionBatch[];
  action: (formData: FormData) => Promise<void>;
}) {
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [packageQuantity, setPackageQuantity] = useState(0);
  const [openedUnits, setOpenedUnits] = useState(0);
  const [clientError, setClientError] = useState("");
  const [requestId, setRequestId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const batch = batches.find(item => item.id === selectedBatchId);
  const product = batch?.item || batch?.catalog_items;
  const packageUnit = product?.purchase_unit || "empaques";
  const location = batch?.location?.name || batch?.locations?.name || "Sin ubicación";

  useEffect(() => {
    setRequestId(crypto.randomUUID());
  }, []);

  const handleBatchChange = (id: string) => {
    const selected = batches.find(item => item.id === id);
    setSelectedBatchId(id);
    setPackageQuantity(selected?.current_stock ? 1 : 0);
    setOpenedUnits(0);
    setClientError("");
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (submitting) {
      event.preventDefault();
      return;
    }
    setClientError("");
    if (packageQuantity <= 0 && openedUnits <= 0) {
      event.preventDefault();
      setClientError("Indica al menos una cantidad de empaques o unidades abiertas para dar de baja.");
      return;
    }
    if (batch && !window.confirm(`¿Confirmas la baja de ${product?.technical_name || "este producto"}, lote ${batch.batch_number}? Esta operación quedará registrada en la trazabilidad.`)) {
      event.preventDefault();
      return;
    }
    setSubmitting(true);
  };

  return (
    <form action={action} onSubmit={handleSubmit} className="form-body inventory-disposition-form">
      <input type="hidden" name="request_id" value={requestId} />
      <div className="form-group form-field-full">
        <label className="form-label" htmlFor="disposition-batch">Producto y lote *</label>
        <select
          id="disposition-batch"
          name="batch_id"
          value={selectedBatchId}
          onChange={event => handleBatchChange(event.target.value)}
          required
          className="form-select"
        >
          <option value="">Seleccione el lote que se dará de baja...</option>
          {batches.map(item => {
            const catalogItem = item.item || item.catalog_items;
            const status = item.clinical_status || item.status || "sin estado";
            return (
              <option key={item.id} value={item.id}>
                {catalogItem?.technical_name || "Producto"} ({catalogItem?.internal_code || "Sin código"})
                {` | Lote: ${item.batch_number} | ${item.current_stock} empaques`}
                {(item.opened_units_remaining || 0) > 0 ? ` + ${item.opened_units_remaining} unidades abiertas` : ""}
                {` | ${item.location?.name || item.locations?.name || "Sin ubicación"} | ${status}`}
              </option>
            );
          })}
        </select>
        <span className="form-hint">Se incluyen lotes aceptados, vencidos, en cuarentena o rechazados que aún tengan existencias.</span>
      </div>

      {batch && (
        <>
          <div className="clinical-batch-summary inventory-disposition-summary">
            <div><strong>Producto:</strong> {product?.technical_name || "No disponible"}</div>
            <div><strong>Lote:</strong> {batch.batch_number}</div>
            <div><strong>Vencimiento:</strong> {formatDate(batch.adjusted_expiration_date || batch.expiration_date)}</div>
            <div><strong>Ubicación:</strong> {location}</div>
            <div><strong>Estado:</strong> {batch.clinical_status || batch.status || "Sin estado"}</div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="disposition-packages">Empaques completos a dar de baja</label>
              <input
                id="disposition-packages"
                className="form-input"
                type="number"
                name="quantity_packages"
                min="0"
                max={batch.current_stock}
                step="1"
                value={packageQuantity}
                onChange={event => setPackageQuantity(Math.min(batch.current_stock, Math.max(0, Number(event.target.value))))}
              />
              <span className="form-hint">Disponible: {batch.current_stock} {packageUnit}.</span>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="disposition-opened-units">Unidades restantes del empaque abierto</label>
              <input
                id="disposition-opened-units"
                className="form-input"
                type="number"
                name="opened_units"
                min="0"
                max={batch.opened_units_remaining || 0}
                step="1"
                value={openedUnits}
                disabled={(batch.opened_units_remaining || 0) === 0}
                onChange={event => setOpenedUnits(Math.min(batch.opened_units_remaining || 0, Math.max(0, Number(event.target.value))))}
              />
              <span className="form-hint">Disponible: {batch.opened_units_remaining || 0} unidades abiertas.</span>
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="disposition-method">Causa de la baja *</label>
              <select id="disposition-method" name="disposition_method" className="form-select" required defaultValue="">
                <option value="" disabled>Seleccione una causa...</option>
                {dispositionCauses.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="disposal-route">Método de disposición final *</label>
              <select id="disposal-route" name="disposal_route" className="form-select" required defaultValue="">
                <option value="" disabled>Seleccione cómo se dispondrá...</option>
                {disposalRoutes.map(route => <option key={route.value} value={route.value}>{route.label}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group form-field-full">
            <label className="form-label" htmlFor="disposition-reason">Detalle y justificación *</label>
            <textarea
              id="disposition-reason"
              name="reason"
              className="form-textarea"
              rows={3}
              minLength={8}
              maxLength={500}
              required
              placeholder="Describe el hallazgo, la autorización o el soporte de la disposición final."
            />
          </div>
        </>
      )}

      {clientError && <div className="error-message" role="alert">{clientError}</div>}

      <div className="inventory-disposition-notice" role="note">
        <ShieldAlert className="ui-icon" aria-hidden="true" />
        <span>La baja es irreversible desde este formulario. Verifica producto, lote y cantidades; el movimiento quedará en la trazabilidad.</span>
      </div>

      <div className="form-actions">
        <button type="submit" className="btn-danger" disabled={!batch || !requestId || submitting}>
          <PackageX className="ui-icon" aria-hidden="true" /> Confirmar baja y disposición
        </button>
      </div>
    </form>
  );
}

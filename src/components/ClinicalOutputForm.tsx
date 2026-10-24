"use client";

import { useState, useMemo } from "react";
import { parseGS1Barcode } from "@/lib/utils/gs1";
import { getDateKeyInBusinessTimeZone } from "@/lib/dates";
import { AlertTriangle, ArrowUpFromLine, CheckCircle2, FlaskConical, ScanLine } from "lucide-react";

interface CatalogItem {
  id: string;
  internal_code: string;
  technical_name: string;
  commercial_name?: string | null;
  purchase_unit?: string | null;
  commercial_presentation?: string | null;
  section_id?: string | null;
  stability_post_opening?: number | null; // horas
}

interface Batch {
  id: string;
  item_id: string;
  batch_number: string;
  expiration_date: string;
  adjusted_expiration_date?: string | null;
  opening_date?: string | null;
  current_stock: number;
  status?: string;
  clinical_status?: string;
  item?: CatalogItem | null;
  catalog_items?: CatalogItem | null;
  location?: { name: string; section_id?: string | null } | null;
  locations?: { name: string; section_id?: string | null } | null;
}

interface Props {
  batches: Batch[];
  action: (formData: FormData) => Promise<void>;
}

export default function ClinicalOutputForm({ batches, sections = [], action }: Props & { sections?: { id: string; name: string }[] }) {
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);
  const [reason, setReason] = useState<string>("Consumo operativo analítico");
  const [equipment, setEquipment] = useState<string>("");
  const [justification, setJustification] = useState<string>("");
  const [markAsOpened, setMarkAsOpened] = useState<boolean>(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  // Filtrar solo lotes activos y aceptados con stock disponible
  const availableBatches = useMemo(() => {
    const today = getDateKeyInBusinessTimeZone(new Date());
      return batches.filter(
      (b) => b.current_stock > 0
        && (b.clinical_status === "accepted" || !b.clinical_status)
        && (b.status === "accepted" || !b.status)
        && (b.adjusted_expiration_date || b.expiration_date) >= today
    ).filter(batch => !selectedSectionId ||
      ((batch.location || batch.locations)?.section_id || (batch.item || batch.catalog_items)?.section_id) === selectedSectionId
    );
  }, [batches, selectedSectionId]);

  // Lista única de productos que tienen stock
  const availableProducts = useMemo(() => {
    const map = new Map<string, CatalogItem>();
    availableBatches.forEach((b) => {
      const item = b.item || b.catalog_items;
      if (item?.id && !map.has(item.id)) {
        map.set(item.id, item);
      }
    });
    return Array.from(map.values()).sort((a, b) => a.technical_name.localeCompare(b.technical_name));
  }, [availableBatches]);

  // Lotes del producto seleccionado ordenados por FEFO estricto (fecha más próxima primero)
  const productBatches = useMemo(() => {
    if (!selectedItemId) return [];
    return availableBatches
      .filter((b) => b.item_id === selectedItemId)
      .sort((a, b) => {
        const dateA = new Date(a.adjusted_expiration_date || a.expiration_date).getTime();
        const dateB = new Date(b.adjusted_expiration_date || b.expiration_date).getTime();
        return dateA - dateB;
      });
  }, [availableBatches, selectedItemId]);

  // El lote sugerido por FEFO es siempre el primero de la lista ordenada
  const fefoSuggestedBatch = productBatches.length > 0 ? productBatches[0] : null;

  // Lote actualmente seleccionado
  const currentBatch = useMemo(() => {
    return availableBatches.find((b) => b.id === selectedBatchId) || null;
  }, [availableBatches, selectedBatchId]);

  // Detección de desviación FEFO: el usuario eligió un lote que vence después del primero sugerido
  const isFefoDeviated = useMemo(() => {
    if (!fefoSuggestedBatch || !currentBatch) return false;
    const selectedExpiration = currentBatch.adjusted_expiration_date || currentBatch.expiration_date;
    const suggestedExpiration = fefoSuggestedBatch.adjusted_expiration_date || fefoSuggestedBatch.expiration_date;
    return selectedExpiration > suggestedExpiration;
  }, [fefoSuggestedBatch, currentBatch]);

  // Manejar escáner de código de barras GS1-128
  const handleBarcodeScan = (code: string) => {
    if (!code || code.trim() === "") return;
    const parsed = parseGS1Barcode(code);
    setScanMessage(null);

    // Intentar buscar por SKU o código interno
    let matchedBatch: Batch | undefined;

    if (parsed.lotNumber) {
      matchedBatch = availableBatches.find(
        (b) => b.batch_number.toLowerCase() === parsed.lotNumber?.toLowerCase()
      );
    }

    if (!matchedBatch && parsed.gtin) {
      const matchedProduct = availableProducts.find(
        (p) => p.internal_code === parsed.gtin || p.id === parsed.gtin
      );
      if (matchedProduct) {
        setSelectedItemId(matchedProduct.id);
        const batchesOfProduct = availableBatches
          .filter((b) => b.item_id === matchedProduct.id)
          .sort((a, b) => new Date(a.adjusted_expiration_date || a.expiration_date).getTime() - new Date(b.adjusted_expiration_date || b.expiration_date).getTime());
        if (batchesOfProduct.length > 0) {
          setSelectedBatchId(batchesOfProduct[0].id);
          setScanMessage(`OK: Producto identificado: ${matchedProduct.technical_name}. Seleccionado lote FEFO.`);
          return;
        }
      }
    }

    if (matchedBatch) {
      setSelectedItemId(matchedBatch.item_id);
      setSelectedBatchId(matchedBatch.id);
      setScanMessage(
        `OK: Lote identificado por código de barras: ${matchedBatch.batch_number} (${matchedBatch.item?.technical_name || "Reactivo"})`
      );
    } else {
      setScanMessage(`Aviso: Código escaneado (${code}): No se encontró un lote activo coincidente con stock.`);
    }
  };

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto" }}>
      {/* BARRA DE ESCÁNER GS1-128 */}
      <div
        style={{
          padding: "1rem 1.25rem",
          backgroundColor: "#f8fafc",
          borderRadius: "var(--radius)",
          border: "1px solid var(--border)",
          marginBottom: "1.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <ScanLine className="ui-icon" aria-hidden="true" />
          <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--navy)" }}>
            Lector de Código de Barras GS1-128 / Búsqueda Rápida
          </span>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            type="text"
            value={barcodeInput}
            onChange={(e) => setBarcodeInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleBarcodeScan(barcodeInput);
              }
            }}
            placeholder="Escanee con pistola o escriba código GS1: ej. (01)...(17)...(10)LOT..."
            style={{
              flex: 1,
              padding: "0.6rem 0.85rem",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              fontSize: "0.875rem",
              backgroundColor: "#ffffff",
            }}
          />
          <button
            type="button"
            onClick={() => handleBarcodeScan(barcodeInput)}
            style={{
              padding: "0.6rem 1rem",
              borderRadius: "8px",
              backgroundColor: "var(--navy)",
              color: "#ffffff",
              border: "none",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Detectar
          </button>
        </div>
        {scanMessage && (
          <div style={{ fontSize: "0.8rem", color: scanMessage.startsWith("OK:") ? "#047857" : "#b45309", marginTop: "2px", display: "flex", alignItems: "center", gap: "0.35rem" }}>
            {scanMessage.startsWith("OK:") ? <CheckCircle2 className="ui-icon" aria-hidden="true" /> : <AlertTriangle className="ui-icon" aria-hidden="true" />}
            {scanMessage.replace(/^(OK:|Aviso:)\s*/, "")}
          </div>
        )}
      </div>

      {/* FORMULARIO DE SALIDA / CONSUMO */}
      <form action={action} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {/* Hidden inputs para invariantes de servidor */}
        <input type="hidden" name="fefo_deviation" value={isFefoDeviated ? "true" : "false"} />
        <input type="hidden" name="mark_as_opened" value={markAsOpened ? "true" : "false"} />

        {/* PASO 1: SELECCIONAR REACTIVO */}
        <div>
          <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "var(--navy)", marginBottom: "0.4rem" }}>
            Área de inventario
          </label>
          <select value={selectedSectionId} onChange={event => {
            setSelectedSectionId(event.target.value);
            setSelectedItemId("");
            setSelectedBatchId("");
          }} style={{ width: "100%", padding: "0.65rem 0.85rem", marginBottom: "0.85rem" }}>
            <option value="">Todas las áreas</option>
            {sections.map(section => <option key={section.id} value={section.id}>{section.name}</option>)}
          </select>
          <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "var(--navy)", marginBottom: "0.4rem" }}>
            1. Producto *
          </label>
          <select
            value={selectedItemId}
            disabled={availableProducts.length === 0}
            onChange={(e) => {
              const itemId = e.target.value;
              setSelectedItemId(itemId);
              const batchesOfProduct = availableBatches
                .filter((b) => b.item_id === itemId)
                .sort((a, b) => new Date(a.adjusted_expiration_date || a.expiration_date).getTime() - new Date(b.adjusted_expiration_date || b.expiration_date).getTime());
              if (batchesOfProduct.length > 0) {
                setSelectedBatchId(batchesOfProduct[0].id);
              } else {
                setSelectedBatchId("");
              }
            }}
            required
            style={{
              width: "100%",
              padding: "0.65rem 0.85rem",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              fontSize: "0.9rem",
              backgroundColor: "#ffffff",
            }}
          >
            <option value="">-- Seleccione un producto del catálogo --</option>
            {availableProducts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.technical_name} [{p.internal_code}] {p.commercial_presentation ? `· ${p.commercial_presentation}` : ""}
              </option>
            ))}
          </select>
          {availableProducts.length === 0 && (
            <p role="status" className="empty-state-text" style={{ marginTop: "0.5rem" }}>
              No hay lotes disponibles para salida. Se muestran lotes con stock, aceptados y vigentes.
            </p>
          )}
        </div>

        {/* PASO 2: SELECCIONAR LOTE (ORDENADO FEFO) */}
        {selectedItemId && (
          <div>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "var(--navy)", marginBottom: "0.4rem" }}>
              2. Selección de Lote Analítico (Algoritmo FEFO) *
            </label>
            <select
              name="batch_id"
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "0.375rem 0.75rem",
                borderRadius: "8px",
                border: isFefoDeviated ? "2px solid #f59e0b" : "1px solid var(--border)",
                fontSize: "0.9rem",
                backgroundColor: "#ffffff",
              }}
            >
              {productBatches.map((b, idx) => {
                const expDate = new Date(b.adjusted_expiration_date || b.expiration_date).toLocaleDateString();
                const isFirst = idx === 0;
                return (
                  <option key={b.id} value={b.id}>
                    {isFirst ? "⭐ [SUGERIDO FEFO] " : ""}Lote: {b.batch_number} | Vence: {expDate} | Disp: {b.current_stock} unidades {b.locations ? `(${b.locations.name})` : ""}
                  </option>
                );
              })}
            </select>
          </div>
        )}

        {/* ALERTA DE DESVIACIÓN FEFO */}
        {isFefoDeviated && fefoSuggestedBatch && (
          <div
            style={{
              padding: "1rem 1.25rem",
              borderRadius: "10px",
              backgroundColor: "#fef3c7",
              border: "1px solid #fcd34d",
              color: "#92400e",
              fontSize: "0.875rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 700, marginBottom: "0.35rem" }}>
              <AlertTriangle className="ui-icon" aria-hidden="true" />
              <span>Advertencia de Desviación FEFO (ISO 15189)</span>
            </div>
            <p style={{ lineHeight: "1.5" }}>
              Está seleccionando el lote <b>{currentBatch?.batch_number}</b> (Vence: {new Date(currentBatch?.adjusted_expiration_date || currentBatch?.expiration_date || "").toLocaleDateString()}), pero existe el lote <b>{fefoSuggestedBatch.batch_number}</b> que vence primero ({new Date(fefoSuggestedBatch.adjusted_expiration_date || fefoSuggestedBatch.expiration_date).toLocaleDateString()}).
            </p>
            <p style={{ marginTop: "0.35rem", fontSize: "0.825rem", fontWeight: 600 }}>
              Para continuar, debe justificar clínicamente esta selección:
            </p>

            <textarea
              name="justification_reason"
              required
              rows={2}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Ej: Calibración específica de corrida analítica / Control de calidad exige este lote específico / Solicitud médica..."
              style={{
                width: "100%",
                marginTop: "0.5rem",
                padding: "0.6rem 0.85rem",
                borderRadius: "8px",
                border: "1px solid #f59e0b",
                fontSize: "0.85rem",
                backgroundColor: "#ffffff",
                color: "#1e293b",
              }}
            />
          </div>
        )}

        {/* PASO 3: CANTIDAD Y MOTIVO */}
        {selectedBatchId && (
          <>
            <div className="form-grid-2" style={{ padding: "0.85rem", background: "var(--bg-app)", borderRadius: "8px" }}>
              <div><strong>Producto:</strong> {currentBatch?.item?.technical_name || currentBatch?.catalog_items?.technical_name || "No aplica"}</div>
              <div><strong>Presentación:</strong> {currentBatch?.item?.commercial_presentation || currentBatch?.catalog_items?.commercial_presentation || "No aplica"}</div>
              <div><strong>Lote:</strong> {currentBatch?.batch_number || "No aplica"}</div>
              <div><strong>Cantidad actual:</strong> {currentBatch?.current_stock || 0}</div>
              <div><strong>Unidad:</strong> {currentBatch?.item?.purchase_unit || currentBatch?.catalog_items?.purchase_unit || "No aplica"}</div>
              <div><strong>Área / ubicación:</strong> {currentBatch?.location?.name || currentBatch?.locations?.name || "No aplica"}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "var(--navy)", marginBottom: "0.4rem" }}>
                  Salida (unidades) *
                </label>
                <input
                  type="number"
                  name="quantity"
                  min="1"
                  max={currentBatch?.current_stock || 9999}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  required
                  style={{
                    width: "100%",
                    padding: "0.375rem 0.75rem",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    fontSize: "0.9rem",
                  }}
                />
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  Disponible: {currentBatch?.current_stock || 0} {currentBatch?.item?.purchase_unit || currentBatch?.catalog_items?.purchase_unit || "unidades"}
                </span>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "var(--navy)", marginBottom: "0.4rem" }}>
                  Motivo de Salida *
                </label>
                <select
                  name="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "0.65rem 0.85rem",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    fontSize: "0.9rem",
                  }}
                >
                  <option value="Consumo operativo analítico">Consumo Operativo Analítico</option>
                  <option value="Montaje de controles y calibradores">Montaje de Controles / Calibradores</option>
                  <option value="Pruebas de verificación o correlación">Pruebas de Verificación / Correlación</option>
                  <option value="Ajuste por consumo en turno de guardia">Turno de Guardia / Urgencias</option>
                </select>
              </div>
            </div>

            {/* CONTROL DE APERTURA / ESTABILIDAD POST-APERTURA */}
            {currentBatch && !currentBatch.opening_date && (
              <div
                style={{
                  padding: "0.85rem 1rem",
                  borderRadius: "8px",
                  backgroundColor: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                }}
              >
                <input
                  type="checkbox"
                  id="chk-open"
                  checked={markAsOpened}
                  onChange={(e) => setMarkAsOpened(e.target.checked)}
                  style={{ width: "18px", height: "18px", cursor: "pointer" }}
                />
                <label htmlFor="chk-open" style={{ fontSize: "0.85rem", color: "#1e3a8a", cursor: "pointer" }}>
                  <FlaskConical className="ui-icon" aria-hidden="true" /> <b>Marcar como abierto/destapado hoy</b>: Iniciar seguimiento de estabilidad post-apertura en el sistema.
                </label>
              </div>
            )}

            {/* EQUIPO O ANALIZADOR DESTINO */}
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "var(--navy)", marginBottom: "0.4rem" }}>
                Equipo o Analizador Destino (Trazabilidad ISO 15189)
              </label>
              <input
                type="text"
                name="equipment"
                value={equipment}
                onChange={(e) => setEquipment(e.target.value)}
                placeholder="Ej: Cobas c311, Sysmex XN-1000, Mindray BC-5380, Stat Fax..."
                style={{
                  width: "100%",
                  padding: "0.65rem 0.85rem",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  fontSize: "0.9rem",
                }}
              />
            </div>

            {/* BOTÓN DE ACCIÓN */}
            <div style={{ marginTop: "1rem", textAlign: "center" }}>
              <button
                type="submit"
                disabled={isFefoDeviated && (!justification || justification.trim() === "")}
                style={{
                  padding: "0.75rem 2rem",
                  borderRadius: "8px",
                  backgroundColor: isFefoDeviated ? "#d97706" : "var(--primary)",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 700,
                  fontSize: "0.95rem",
                  cursor: isFefoDeviated && (!justification || justification.trim() === "") ? "not-allowed" : "pointer",
                  boxShadow: "var(--shadow-md)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <ArrowUpFromLine className="ui-icon" aria-hidden="true" /> Confirmar Salida de Inventario
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}

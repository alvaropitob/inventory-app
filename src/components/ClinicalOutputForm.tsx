"use client";

import { useState, useMemo, useEffect } from "react";
import { parseGS1Barcode } from "@/lib/utils/gs1";
import { getExpirationSemaforo } from "@/lib/expiration-semaforo";
import { parseUnitsFromPresentation } from "@/lib/utils/presentation";
import ContextualHelp from "@/components/ContextualHelp";
import { AlertTriangle, ArrowUpFromLine, CheckCircle2, FlaskConical, Layers, ScanLine } from "lucide-react";

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
  opened_units_remaining?: number;
  opened_units_per_package?: number;
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
  const [isFractional, setIsFractional] = useState<boolean>(false);
  const [fractionalUnits, setFractionalUnits] = useState<number>(1);
  const [reason, setReason] = useState<string>("Consumo operativo analítico");
  const [equipment, setEquipment] = useState<string>("");
  const [justification, setJustification] = useState<string>("");
  const [markAsOpened, setMarkAsOpened] = useState<boolean>(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  useEffect(() => {
    setQuantity(1);
    setFractionalUnits(1);
    const selectedBatch = batches.find((batch) => batch.id === selectedBatchId);
    const product = selectedBatch?.item || selectedBatch?.catalog_items;
    const packageUnits = selectedBatch?.opened_units_per_package || parseUnitsFromPresentation(product?.commercial_presentation);
    setIsFractional(!!selectedBatch && (packageUnits || 0) > 1);
  }, [selectedBatchId, batches]);

  // Incluir empaques sin abrir y unidades que quedaron en un empaque abierto.
  const availableBatches = useMemo(() => {
    const activeSectionIds = new Set(sections.map(section => section.id));
    return batches.filter(
      (b) => {
        const batchSectionId = b.location?.section_id || b.locations?.section_id;
        return Boolean(batchSectionId && activeSectionIds.has(batchSectionId))
          && (b.current_stock > 0 || (b.opened_units_remaining || 0) > 0)
          && (b.clinical_status === "accepted" || !b.clinical_status)
          && (b.status === "accepted" || !b.status)
          && getExpirationSemaforo(b.adjusted_expiration_date || b.expiration_date, b.status, b.clinical_status).state !== "expired";
      }
    ).filter(batch => {
      if (!selectedSectionId) return true;
      const batchSectionId = batch.location?.section_id || batch.locations?.section_id;
      return batchSectionId === selectedSectionId;
    });
  }, [batches, sections, selectedSectionId]);

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

  // Unidades por presentación comercial (ej. Kit x 100 -> 100)
  const unitsInPackage = useMemo(() => {
    if ((currentBatch?.opened_units_per_package || 0) > 1) return currentBatch!.opened_units_per_package!;
    const pres = currentBatch?.item?.commercial_presentation || currentBatch?.catalog_items?.commercial_presentation;
    return parseUnitsFromPresentation(pres);
  }, [currentBatch]);

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
    <div className="clinical-output-form-wrap">
      {/* BARRA DE ESCÁNER GS1-128 */}
      <div className="clinical-scan-panel">
        <div className="clinical-scan-heading">
          <ScanLine className="ui-icon" aria-hidden="true" />
          <span className="clinical-scan-title">
            Lector de Código de Barras GS1-128 / Búsqueda Rápida
          </span>
        </div>
        <div className="clinical-scan-controls">
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
            className="form-input"
          />
          <button
            type="button"
            onClick={() => handleBarcodeScan(barcodeInput)}
            className="btn-secondary clinical-scan-button"
          >
            Detectar
          </button>
        </div>
        {scanMessage && (
          <div className={`clinical-scan-message ${scanMessage.startsWith("OK:") ? "clinical-scan-success" : "clinical-scan-warning"}`} role="status">
            {scanMessage.startsWith("OK:") ? <CheckCircle2 className="ui-icon" aria-hidden="true" /> : <AlertTriangle className="ui-icon" aria-hidden="true" />}
            {scanMessage.replace(/^(OK:|Aviso:)\s*/, "")}
          </div>
        )}
      </div>

      {/* FORMULARIO DE SALIDA / CONSUMO */}
      <form action={action} className="form-fields clinical-consumption-form">
        {/* Hidden inputs para invariantes de servidor */}
        <input type="hidden" name="fefo_deviation" value={isFefoDeviated ? "true" : "false"} />
        <input type="hidden" name="mark_as_opened" value={markAsOpened || isFractional ? "true" : "false"} />
        <input type="hidden" name="is_fractional" value={isFractional ? "true" : "false"} />
        <input type="hidden" name="fractional_units" value={fractionalUnits} />
        <input type="hidden" name="presentation_units" value={unitsInPackage || ""} />

        {/* PASO 1: SELECCIONAR REACTIVO */}
        <div className="form-group">
          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <label className="form-label">Área de inventario</label>
            <ContextualHelp content={{ title: "Área y unidad de salida", description: "El área filtra los lotes por ubicación; no determina si debes retirar cajas o unidades.", steps: ["En el flujo habitual de Especiales se suele retirar por unidad.", "En Química se suele retirar por caja/empaque cuando el consumo es de líquido.", "Confirma la presentación del producto y selecciona el modo que corresponda antes de registrar la salida."], tips: ["La guía por área no es una regla automática: el formulario permite elegir el modo para cada salida."] }} />
          </div>
          <select value={selectedSectionId} onChange={event => {
            setSelectedSectionId(event.target.value);
            setSelectedItemId("");
            setSelectedBatchId("");
          }} className="form-select clinical-area-select">
            <option value="">Todas las áreas</option>
            {sections.map(section => <option key={section.id} value={section.id}>{section.name}</option>)}
          </select>
          <label className="form-label">
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
            className="form-select"
          >
            <option value="">-- Seleccione un producto del catálogo --</option>
            {availableProducts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.technical_name} [{p.internal_code}] {p.commercial_presentation ? `· ${p.commercial_presentation}` : ""}
              </option>
            ))}
          </select>
          {availableProducts.length === 0 && (
            <p role="status" className="empty-state-text clinical-empty-stock">
              No hay lotes disponibles para salida. Se muestran lotes con stock, aceptados y vigentes.
            </p>
          )}
        </div>

        {/* PASO 2: SELECCIONAR LOTE (ORDENADO FEFO) */}
        {selectedItemId && (
          <div className="form-group">
            <label className="form-label">
              2. Selección de Lote Analítico (Algoritmo FEFO) *
            </label>
            <select
              name="batch_id"
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              required
              className={`form-select ${isFefoDeviated ? "clinical-batch-warning" : ""}`}
            >
              {productBatches.map((b, idx) => {
                const expirationDate = b.adjusted_expiration_date || b.expiration_date;
                const expDate = new Date(expirationDate).toLocaleDateString();
                const semaforo = getExpirationSemaforo(expirationDate, b.status, b.clinical_status);
                const isFirst = idx === 0;
                const locName = b.location?.name || b.locations?.name;
                return (
                  <option key={b.id} value={b.id} style={{ color: semaforo.color }}>
                    {isFirst ? "⭐ [SUGERIDO FEFO] " : ""}Lote: {b.batch_number} | Vence: {expDate} ({semaforo.label}{semaforo.state === "near_expiry" ? ` · ${semaforo.daysRemaining} días` : ""}) | Disp: {b.current_stock} empaques{(b.opened_units_remaining || 0) > 0 ? ` + ${b.opened_units_remaining} unidades abiertas` : ""} {locName ? `(${locName})` : ""}
                  </option>
                );
              })}
            </select>
          </div>
        )}

        {/* ALERTA DE DESVIACIÓN FEFO */}
        {isFefoDeviated && fefoSuggestedBatch && (
          <div className="clinical-fefo-alert">
            <div className="clinical-fefo-alert-title">
              <AlertTriangle className="ui-icon" aria-hidden="true" />
              <span>Advertencia de Desviación FEFO (ISO 15189)</span>
            </div>
            <p>
              Está seleccionando el lote <b>{currentBatch?.batch_number}</b> (Vence: {new Date(currentBatch?.adjusted_expiration_date || currentBatch?.expiration_date || "").toLocaleDateString()}), pero existe el lote <b>{fefoSuggestedBatch.batch_number}</b> que vence primero ({new Date(fefoSuggestedBatch.adjusted_expiration_date || fefoSuggestedBatch.expiration_date).toLocaleDateString()}).
            </p>
            <p className="clinical-fefo-prompt">
              Para continuar, debe justificar clínicamente esta selección:
            </p>

            <textarea
              name="justification_reason"
              required
              rows={2}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Ej: Calibración específica de corrida analítica / Control de calidad exige este lote específico / Solicitud médica..."
              className="form-textarea clinical-fefo-justification"
            />
          </div>
        )}

        {/* PASO 3: CANTIDAD Y MOTIVO */}
        {selectedBatchId && (
          <>
            <div className="form-grid-2 clinical-batch-summary">
              <div><strong>Producto:</strong> {currentBatch?.item?.technical_name || currentBatch?.catalog_items?.technical_name || "No aplica"}</div>
              <div><strong>Presentación:</strong> {currentBatch?.item?.commercial_presentation || currentBatch?.catalog_items?.commercial_presentation || "No aplica"}</div>
              <div><strong>Lote:</strong> {currentBatch?.batch_number || "No aplica"}</div>
              <div><strong>Empaques sin abrir:</strong> {currentBatch?.current_stock || 0}</div>
              {(currentBatch?.opened_units_remaining || 0) > 0 && <div><strong>Unidades del empaque abierto:</strong> {currentBatch?.opened_units_remaining}</div>}
              <div><strong>Unidad:</strong> {currentBatch?.item?.purchase_unit || currentBatch?.catalog_items?.purchase_unit || "No aplica"}</div>
              <div><strong>Área / ubicación:</strong> {currentBatch?.location?.name || currentBatch?.locations?.name || "No aplica"}</div>
            </div>
            {/* OPCIÓN DE CONSUMO FRACCIONADO PARA PRESENTACIONES EN KIT / CAJA */}
            {unitsInPackage && unitsInPackage > 1 && (
              <div className={`clinical-fractional-panel ${isFractional ? "clinical-fractional-active" : ""}`}>
                <div className="clinical-fractional-heading">
                  <div className="clinical-fractional-title-wrap">
                    <Layers className={`ui-icon ${isFractional ? "clinical-fractional-icon-active" : ""}`} aria-hidden="true" />
                    <span className="clinical-fractional-title">
                      Presentación comercial con unidades internas ({unitsInPackage} por empaque)
                    </span>
                  </div>
                  <div className="clinical-fractional-options">
                    <button
                      type="button"
                      disabled={(currentBatch?.current_stock || 0) <= 0}
                      onClick={() => {
                        setIsFractional(false);
                        setQuantity(1);
                      }}
                      className={`clinical-mode-option ${!isFractional ? "clinical-mode-option-active" : ""}`}
                    >
                      Sacar caja/kit completo
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsFractional(true);
                        setQuantity(1);
                        if (!fractionalUnits || fractionalUnits <= 0) setFractionalUnits(1);
                      }}
                      className={`clinical-mode-option clinical-mode-fractional ${isFractional ? "clinical-mode-option-active" : ""}`}
                    >
                      Sacar unidades/pruebas de una caja
                    </button>
                  </div>
                </div>

                {isFractional && (
                  <div className="clinical-fractional-info">
                    <div className="clinical-fractional-availability">
                      <span>
                        Disponibles: <b>{(currentBatch?.current_stock || 0) * unitsInPackage + (currentBatch?.opened_units_remaining || 0)}</b> unidades en total. Quedarán {(currentBatch?.current_stock || 0) * unitsInPackage + (currentBatch?.opened_units_remaining || 0) - (fractionalUnits || 0)}.
                      </span>
                    </div>
                    <span className="clinical-fractional-hint">
                      💡 La caja/kit se abrirá automáticamente para seguimiento analítico post-apertura.
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="form-grid-2 clinical-consumption-fields">
              <div className="form-group">
                <label className="form-label">
                  {isFractional ? "Unidades internas a retirar *" : "Empaques completos a retirar *"}
                </label>
                {isFractional ? (
                  <input
                    type="number"
                    min="1"
                    max={(currentBatch?.current_stock || 0) * (unitsInPackage || 0) + (currentBatch?.opened_units_remaining || 0)}
                    value={fractionalUnits}
                    onChange={(e) => setFractionalUnits(Math.min((currentBatch?.current_stock || 0) * (unitsInPackage || 0) + (currentBatch?.opened_units_remaining || 0), Math.max(1, Number(e.target.value))))}
                    required
                    className="form-input"
                  />
                ) : (
                  <input
                    type="number"
                    name="quantity"
                    min="1"
                    max={currentBatch?.current_stock || 0}
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    disabled={(currentBatch?.current_stock || 0) <= 0}
                    required
                    className="form-input"
                  />
                )}
                <span className="form-hint">
                  {isFractional
                    ? `Disponibles: ${(currentBatch?.current_stock || 0) * (unitsInPackage || 0) + (currentBatch?.opened_units_remaining || 0)} unidades internas`
                    : `Disponibles: ${currentBatch?.current_stock || 0} ${currentBatch?.item?.purchase_unit || currentBatch?.catalog_items?.purchase_unit || "empaques"}`}
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Motivo de Salida *
                </label>
                <select
                  name="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  className="form-select"
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
              <div className="clinical-open-toggle">
                <input
                  type="checkbox"
                  id="chk-open"
                  checked={markAsOpened}
                  onChange={(e) => setMarkAsOpened(e.target.checked)}
                  className="clinical-open-checkbox"
                />
                <label htmlFor="chk-open" className="clinical-open-label">
                  <FlaskConical className="ui-icon" aria-hidden="true" /> <b>Marcar como abierto/destapado hoy</b>: Iniciar seguimiento de estabilidad post-apertura en el sistema.
                </label>
              </div>
            )}

            {/* EQUIPO O ANALIZADOR DESTINO */}
            <div className="form-group">
              <label className="form-label">
                Equipo o Analizador Destino (Trazabilidad ISO 15189)
              </label>
              <input
                type="text"
                name="equipment"
                value={equipment}
                onChange={(e) => setEquipment(e.target.value)}
                placeholder="Ej: Cobas c311, Sysmex XN-1000, Mindray BC-5380, Stat Fax..."
                className="form-input"
              />
            </div>

            {/* BOTÓN DE ACCIÓN */}
            <div className="clinical-consumption-submit">
              <button
                type="submit"
                disabled={isFefoDeviated && (!justification || justification.trim() === "")}
                className={`btn-primary clinical-consumption-button ${isFefoDeviated ? "clinical-consumption-button-warning" : ""}`}
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

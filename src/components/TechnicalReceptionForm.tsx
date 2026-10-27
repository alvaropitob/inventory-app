"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitTechnicalReception } from "@/app/dashboard/recepcion/actions";
import ContextualHelp from "./ContextualHelp";
import { parseGS1Barcode } from "@/lib/utils/gs1";
import { filterLocationsForSection } from "@/lib/utils/locations";

interface OrderItem {
    catalog_item_id: string;
    catalog_item: {
        internal_code: string;
        technical_name: string;
        commercial_name: string;
        section_id?: string | null;
        section_name?: string | null;
        section_is_active?: boolean;
    };
    quantity_requested: number;
    quantity_received: number;
    estimated_unit_price: number;
}

interface Order {
    id: string;
    order_number: string;
    supplier: { name: string };
    items: OrderItem[];
}

interface Location { id: string; name: string; section_id?: string | null; location_type?: string; sections?: { name: string } | null; }
interface Section { id: string; name: string; is_active: boolean; }

export default function TechnicalReceptionForm({ order, locations, sections }: { order: Order; locations: Location[]; sections: Section[] }) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form states
    const [packagingStatus, setPackagingStatus] = useState("Intacto");
    const [integrityVerified] = useState(true);
    const [receptionTemp, setReceptionTemp] = useState("20");
    const [isApproved, setIsApproved] = useState(true);
    const [notes, setNotes] = useState("");
    const [invoiceNumber, setInvoiceNumber] = useState("");

    const locationsForArea = (sectionId?: string | null) => filterLocationsForSection(locations, sectionId);

    // Items states (lot, expiration, qty, price per item)
    const [itemData, setItemData] = useState<Record<string, { lot: string, exp: string, qty: number, price: number, section_id: string, location_id: string }>>(
        order.items.reduce((acc, item) => {
            const sectionId = item.catalog_item.section_is_active ? item.catalog_item.section_id || "" : "";
            const areaLocations = locationsForArea(sectionId);
            return {
                ...acc,
                [item.catalog_item_id]: {
                    lot: "",
                    exp: "",
                    qty: Math.max(0, item.quantity_requested - item.quantity_received),
                    price: item.estimated_unit_price,
                    section_id: sectionId,
                    location_id: areaLocations[0]?.id || "",
                }
            };
        }, {})
    );

    const handleItemChange = (itemId: string, field: 'lot' | 'exp' | 'qty' | 'section_id' | 'location_id', value: string | number) => {
        setItemData(prev => ({
            ...prev,
            [itemId]: { ...prev[itemId], [field]: value }
        }));
    };

    const handleAreaChange = (itemId: string, sectionId: string) => {
        const firstLocation = locationsForArea(sectionId)[0];
        setItemData(prev => ({
            ...prev,
            [itemId]: { ...prev[itemId], section_id: sectionId, location_id: firstLocation?.id || "" }
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (!receptionTemp.trim()) throw new Error("Ingresa la temperatura en °C.");
            const normalizedTemperature = Number(receptionTemp.trim().replace(",", "."));
            if (!Number.isFinite(normalizedTemperature)) throw new Error("Ingresa una temperatura válida en °C.");
            // Solo se registran los renglones que sí llegaron. Lote y vencimiento
            // vacíos indican que el producto sigue pendiente en el pedido.
            const itemsToSubmit = order.items.flatMap(item => {
                const data = itemData[item.catalog_item_id];
                const remaining = item.quantity_requested - item.quantity_received;
                if (data.qty <= 0) return [];
                if (data.qty > remaining) {
                    throw new Error(`La cantidad recibida supera el saldo pendiente de ${item.catalog_item.technical_name}`);
                }
                if (!data.lot.trim() && !data.exp) return [];
                if (!data.lot.trim() || !data.exp) {
                    throw new Error(`Faltan datos de lote/vencimiento para ${item.catalog_item.technical_name}`);
                }
                if (!data.section_id || !data.location_id) {
                    throw new Error(`Selecciona el área y la ubicación de ${item.catalog_item.technical_name}`);
                }
                return [{
                    catalog_item_id: item.catalog_item_id,
                    section_id: data.section_id,
                    lot_number: data.lot,
                    expiration_date: data.exp,
                    quantity_received: Number(data.qty),
                    location_id: data.location_id,
                    unit_price: Number(data.price)
                }];
            });
            if (itemsToSubmit.length === 0) throw new Error("Ingresa los datos de lote y vencimiento de al menos un producto recibido.");

            await submitTechnicalReception({
                order_id: order.id,
                invoice_number: invoiceNumber,
                packaging_status: packagingStatus,
                integrity_verified: integrityVerified,
                reception_temperature: normalizedTemperature,
                is_approved: isApproved,
                notes: notes,
                items: itemsToSubmit
            });

            router.push("/dashboard/recepcion");
            router.refresh();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Error al procesar la recepción");
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="form-container">
            {error && <div className="error-message">{error}</div>}

            <div className="form-row reception-summary-fields">
                <div className="form-group">
                    <label>Condiciones de empaque, envase y etiqueta</label>
                    <select value={packagingStatus} onChange={e => setPackagingStatus(e.target.value)}>
                        <option value="Intacto">Intacto / Buen Estado</option>
                        <option value="Dañado">Dañado / Alterado</option>
                        <option value="Dudoso">Dudoso</option>
                    </select>
                </div>
                <div className="form-group">
                    <label>Temperatura (°C)</label>
                    <input 
                        type="text"
                        inputMode="decimal"
                        value={receptionTemp} 
                        onChange={e => setReceptionTemp(e.target.value)}
                        placeholder="Ej. 20,5"
                        required
                    />
                </div>
                <div className="form-group">
                    <label>Resultado global</label>
                    <select value={isApproved ? "true" : "false"} onChange={e => setIsApproved(e.target.value === "true")}>
                        <option value="true">APROBADO PARA USO</option>
                        <option value="false">EN CUARENTENA / RECHAZADO</option>
                    </select>
                </div>
            </div>

            <div className="form-group reception-invoice-field">
                <label>Número de factura</label>
                <input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="Factura del proveedor" required />
            </div>

            <h3 className="reception-section-title">
                Detalle de Ítems y Lotes
                <ContextualHelp content={{
                    title: "Inspección de Lotes",
                    description: "Verifique producto, cantidades, factura, lote y vencimiento. El precio se toma del pedido y no se diligencia durante la recepción.",
                    steps: [
                        "Confirme que el producto recibido corresponda a la orden de compra.",
                        "Compare la cantidad recibida con la orden y la factura.",
                        "Registre el número de factura, lote y fecha de vencimiento tal como aparecen en los documentos y el envase.",
                        "Use el escaneo GS1-128 cuando el empaque tenga un código legible."
                    ],
                    tips: ["Si hay diferencias, daño, temperatura inadecuada o documentación incompleta, deje constancia y no libere el lote sin revisión."]
                }} />
            </h3>
            
            <div className="table-responsive reception-items-table-wrap">
                <table className="data-table reception-items-table">
                    <thead>
                        <tr>
                            <th>Producto</th>
                            <th className="cell-center">Solicitado</th>
                            <th className="cell-center">Pendiente</th>
                            <th className="fulfillment-header cell-center">Recibido</th>
                            <th className="fulfillment-header">Área</th>
                            <th className="fulfillment-header">Ubicación</th>
                            <th className="fulfillment-header">Número de Lote</th>
                            <th className="fulfillment-header">Vencimiento</th>
                            <th className="fulfillment-header reception-scan-column">Escanear GS1-128</th>
                        </tr>
                    </thead>
                    <tbody>
                        {order.items.map((item) => (
                            <tr key={item.catalog_item_id}>
                                <td>
                                    <div className="reception-product-name">{item.catalog_item.technical_name}</div>
                                    <div className="cell-muted">{item.catalog_item.commercial_name} ({item.catalog_item.internal_code})</div>
                                </td>
                                <td className="cell-center reception-requested">{item.quantity_requested}</td>
                                <td className="cell-center">{Math.max(0, item.quantity_requested - item.quantity_received)}</td>
                                <td>
                                    <input 
                                        type="number" 
                                        min="0"
                                        max={Math.max(0, item.quantity_requested - item.quantity_received)}
                                        disabled={item.quantity_requested <= item.quantity_received}
                                        value={itemData[item.catalog_item_id].qty}
                                        onChange={e => handleItemChange(item.catalog_item_id, 'qty', Number(e.target.value))}
                                        className="table-input reception-quantity"
                                        required
                                    />
                                </td>
                                <td>
                                    <select value={itemData[item.catalog_item_id].section_id} onChange={e => handleAreaChange(item.catalog_item_id, e.target.value)} className="table-input" required={itemData[item.catalog_item_id].qty > 0 && Boolean(itemData[item.catalog_item_id].lot.trim()) && Boolean(itemData[item.catalog_item_id].exp)} disabled={item.quantity_requested <= item.quantity_received}>
                                        <option value="">Seleccione área...</option>
                                        {sections.map(section => <option key={section.id} value={section.id}>{section.name}</option>)}
                                    </select>
                                </td>
                                <td>
                                    <select value={itemData[item.catalog_item_id].location_id} onChange={e => handleItemChange(item.catalog_item_id, 'location_id', e.target.value)} className="table-input" required={itemData[item.catalog_item_id].qty > 0 && Boolean(itemData[item.catalog_item_id].lot.trim()) && Boolean(itemData[item.catalog_item_id].exp)} disabled={item.quantity_requested <= item.quantity_received}>
                                        <option value="">{locationsForArea(itemData[item.catalog_item_id].section_id).length ? "Seleccione ubicación..." : "Sin ubicaciones para esta área"}</option>
                                        {locationsForArea(itemData[item.catalog_item_id].section_id).map(location => (
                                            <option key={location.id} value={location.id}>
                                                {location.name}
                                            </option>
                                        ))}
                                    </select>
                                    {itemData[item.catalog_item_id].section_id && locationsForArea(itemData[item.catalog_item_id].section_id).length === 0 && (
                                        <small className="reception-location-help">
                                            No hay ubicaciones para esta área. <a href={`/dashboard/configuracion?tab=ubicaciones&sectionId=${encodeURIComponent(itemData[item.catalog_item_id].section_id)}`} target="_blank" rel="noreferrer">Crear ubicación en Configuración</a>.
                                        </small>
                                    )}
                                </td>
                                <td>
                                    <input 
                                        type="text" 
                                        placeholder="LOTE-XXXX"
                                        value={itemData[item.catalog_item_id].lot}
                                        onChange={e => handleItemChange(item.catalog_item_id, 'lot', e.target.value)}
                                        className="table-input"
                                    />
                                    <small className="reception-pending-help">Si no llegó, indique 0 en Recibido y deje lote y vencimiento vacíos. El saldo seguirá pendiente en el pedido.</small>
                                </td>
                                <td>
                                    <input 
                                        type="date"
                                        value={itemData[item.catalog_item_id].exp}
                                        onChange={e => handleItemChange(item.catalog_item_id, 'exp', e.target.value)}
                                        className="table-input"
                                    />
                                </td>
                                <td>
                                    <input
                                        type="text"
                                        placeholder="Escanee código aquí..."
                                        className="table-input"

                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val && val.length > 5) {
                                                const parsed = parseGS1Barcode(val);
                                                if (parsed.lotNumber) {
                                                    handleItemChange(item.catalog_item_id, 'lot', parsed.lotNumber);
                                                }
                                                if (parsed.expirationDate) {
                                                    handleItemChange(item.catalog_item_id, 'exp', parsed.expirationDate);
                                                }
                                            }
                                        }}
                                    />
                                </td>
                            </tr>
                        ))}
                {order.items.length === 0 && (
                    <tr><td colSpan={9} className="empty-state">Esta orden no tiene productos para recibir.</td></tr>
                )}
                    </tbody>
                </table>
            </div>

            {sections.length === 0 && (
                <div className="error-message">No hay áreas activas. Crea un área en Configuración antes de confirmar la recepción.</div>
            )}
            {locations.length === 0 && (
                <div className="error-message">No hay ubicaciones activas. Asigna una ubicación a un área en Configuración antes de confirmar la recepción.</div>
            )}

            <div className="form-group reception-notes-field">
                <label>Notas de la Inspección</label>
                <textarea 
                    rows={3} 
                    value={notes} 
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Agregue detalles sobre la inspección técnica o motivos de rechazo..."
                />
            </div>

            <div className="form-actions reception-actions">
                <button 
                    type="button" 
                    onClick={() => router.back()} 
                    className="btn-secondary"
                >
                    Volver
                </button>
                <button 
                    type="submit" 
                    className="btn-primary"
                    disabled={loading}
                >
                    {loading ? "Registrando..." : "Confirmar Recepción Técnica"}
                </button>
            </div>
        </form>
    );
}

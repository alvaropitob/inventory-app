"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitTechnicalReception } from "@/app/dashboard/recepcion/actions";
import ContextualHelp from "./ContextualHelp";
import { parseGS1Barcode } from "@/lib/utils/gs1";

interface OrderItem {
    catalog_item_id: string;
    catalog_item: {
        internal_code: string;
        technical_name: string;
        commercial_name: string;
        section_id?: string | null;
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

interface Location { id: string; name: string; section_id?: string | null; location_type?: string; }

export default function TechnicalReceptionForm({ order, locations }: { order: Order; locations: Location[] }) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form states
    const [packagingStatus, setPackagingStatus] = useState("Intacto");
    const [integrityVerified] = useState(true);
    const [receptionTemp, setReceptionTemp] = useState(20);
    const [isApproved, setIsApproved] = useState(true);
    const [notes, setNotes] = useState("");
    const [invoiceNumber, setInvoiceNumber] = useState("");

    const locationsForItem = (item: OrderItem) => locations.filter(location =>
        !item.catalog_item.section_id || !location.section_id || location.section_id === item.catalog_item.section_id
    );

    // Items states (lot, expiration, qty, price per item)
    const [itemData, setItemData] = useState<Record<string, { lot: string, exp: string, qty: number, price: number, location_id: string }>>(
        order.items.reduce((acc, item) => ({
            ...acc,
            [item.catalog_item_id]: { 
                lot: "", 
                exp: "", 
                qty: Math.max(0, item.quantity_requested - item.quantity_received),
                price: item.estimated_unit_price,
                location_id: locationsForItem(item).find(location => location.section_id === item.catalog_item.section_id)?.id || locationsForItem(item)[0]?.id || "",
            }
        }), {})
    );

    const handleItemChange = (itemId: string, field: 'lot' | 'exp' | 'qty' | 'location_id', value: string | number) => {
        setItemData(prev => ({
            ...prev,
            [itemId]: { ...prev[itemId], [field]: value }
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // Check if all items have lot and exp
            const itemsToSubmit = order.items.filter(item => itemData[item.catalog_item_id].qty > 0).map(item => {
                const data = itemData[item.catalog_item_id];
                const remaining = item.quantity_requested - item.quantity_received;
                if (!data.lot || !data.exp) {
                    throw new Error(`Faltan datos de lote/vencimiento para ${item.catalog_item.technical_name}`);
                }
                if (!data.location_id || data.qty > remaining) {
                    throw new Error(`Revisa ubicación y cantidad pendiente de ${item.catalog_item.technical_name}`);
                }
                return {
                    catalog_item_id: item.catalog_item_id,
                    lot_number: data.lot,
                    expiration_date: data.exp,
                    quantity_received: Number(data.qty),
                    location_id: data.location_id,
                    unit_price: Number(data.price)
                };
            });
            if (itemsToSubmit.length === 0) throw new Error("Ingresa al menos un producto recibido.");

            await submitTechnicalReception({
                order_id: order.id,
                invoice_number: invoiceNumber,
                packaging_status: packagingStatus,
                integrity_verified: integrityVerified,
                reception_temperature: Number(receptionTemp),
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

            <div className="form-row" style={{ marginBottom: '2rem' }}>
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
                        type="number" 
                        step="0.1" 
                        value={receptionTemp} 
                        onChange={e => setReceptionTemp(Number(e.target.value))} 
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

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label>Número de factura</label>
                <input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="Factura del proveedor" required />
            </div>

            <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
            
            <div className="table-responsive" style={{ marginBottom: '2rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: 'var(--bg-app)' }}>
                        <tr>
                            <th style={{ padding: '1rem', textAlign: 'left' }}>Producto</th>
                            <th style={{ padding: '1rem', textAlign: 'center' }}>Solicitado</th>
                            <th style={{ padding: '1rem', textAlign: 'center' }}>Pendiente</th>
                            <th className="fulfillment-header" style={{ padding: '1rem', textAlign: 'center' }}>Recibido</th>
                            <th className="fulfillment-header" style={{ padding: '1rem', textAlign: 'left' }}>Ubicación</th>
                            <th className="fulfillment-header" style={{ padding: '1rem', textAlign: 'left' }}>Número de Lote</th>
                            <th className="fulfillment-header" style={{ padding: '1rem', textAlign: 'left' }}>Vencimiento</th>
                            <th className="fulfillment-header" style={{ padding: '1rem', textAlign: 'left', minWidth: '180px' }}>Escanear GS1-128</th>
                        </tr>
                    </thead>
                    <tbody>
                        {order.items.map((item) => (
                            <tr key={item.catalog_item_id} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '1rem' }}>
                                    <div style={{ fontWeight: '700' }}>{item.catalog_item.technical_name}</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{item.catalog_item.commercial_name} ({item.catalog_item.internal_code})</div>
                                </td>
                                <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 'bold', color: 'var(--text-muted)' }}>{item.quantity_requested}</td>
                                <td style={{ padding: '1rem', textAlign: 'center' }}>{Math.max(0, item.quantity_requested - item.quantity_received)}</td>
                                <td style={{ padding: '1rem' }}>
                                    <input 
                                        type="number" 
                                        min="0"
                                        max={Math.max(0, item.quantity_requested - item.quantity_received)}
                                        disabled={item.quantity_requested <= item.quantity_received}
                                        value={itemData[item.catalog_item_id].qty}
                                        onChange={e => handleItemChange(item.catalog_item_id, 'qty', Number(e.target.value))}
                                        className="table-input"
                                        style={{ width: '100px', textAlign: 'center' }}
                                        required
                                    />
                                </td>
                                <td style={{ padding: '1rem' }}>
                                    <select value={itemData[item.catalog_item_id].location_id} onChange={e => handleItemChange(item.catalog_item_id, 'location_id', e.target.value)} className="table-input" required={itemData[item.catalog_item_id].qty > 0} disabled={item.quantity_requested <= item.quantity_received}>
                                        <option value="">Seleccione...</option>
                                        {locationsForItem(item).map(location => <option key={location.id} value={location.id}>{location.name}</option>)}
                                    </select>
                                </td>
                                <td style={{ padding: '1rem' }}>
                                    <input 
                                        type="text" 
                                        placeholder="LOTE-XXXX"
                                        value={itemData[item.catalog_item_id].lot}
                                        onChange={e => handleItemChange(item.catalog_item_id, 'lot', e.target.value)}
                                        className="table-input"
                                        required={itemData[item.catalog_item_id].qty > 0}
                                    />
                                </td>
                                <td style={{ padding: '1rem' }}>
                                    <input 
                                        type="date"
                                        value={itemData[item.catalog_item_id].exp}
                                        onChange={e => handleItemChange(item.catalog_item_id, 'exp', e.target.value)}
                                        className="table-input"
                                        required={itemData[item.catalog_item_id].qty > 0}
                                    />
                                </td>
                                <td style={{ padding: '1rem' }}>
                                    <input
                                        type="text"
                                        placeholder="Escanee código aquí..."
                                        className="table-input"
                                        style={{ fontSize: '0.75rem', backgroundColor: '#f8fafc' }}
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
                    </tbody>
                </table>
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label>Notas de la Inspección</label>
                <textarea 
                    rows={3} 
                    value={notes} 
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Agregue detalles sobre la inspección técnica o motivos de rechazo..."
                />
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
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

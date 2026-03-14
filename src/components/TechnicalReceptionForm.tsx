"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitTechnicalReception } from "@/app/dashboard/recepcion/actions";
import ContextualHelp from "./ContextualHelp";

interface OrderItem {
    catalog_item_id: string;
    catalog_item: {
        internal_code: string;
        technical_name: string;
        commercial_name: string;
    };
    quantity_requested: number;
    estimated_unit_price: number;
}

interface Order {
    id: string;
    order_number: string;
    supplier: { name: string };
    items: OrderItem[];
}

export default function TechnicalReceptionForm({ order }: { order: Order }) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form states
    const [packagingStatus, setPackagingStatus] = useState("Intacto");
    const [integrityVerified] = useState(true);
    const [receptionTemp, setReceptionTemp] = useState(20);
    const [isApproved, setIsApproved] = useState(true);
    const [notes, setNotes] = useState("");

    // Items states (lot and expiration per item)
    const [itemData, setItemData] = useState<Record<string, { lot: string, exp: string }>>(
        order.items.reduce((acc, item) => ({
            ...acc,
            [item.catalog_item_id]: { lot: "", exp: "" }
        }), {})
    );

    const handleItemChange = (itemId: string, field: 'lot' | 'exp', value: string) => {
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
            const itemsToSubmit = order.items.map(item => {
                const data = itemData[item.catalog_item_id];
                if (!data.lot || !data.exp) {
                    throw new Error(`Faltan datos de lote/vencimiento para ${item.catalog_item.technical_name}`);
                }
                return {
                    catalog_item_id: item.catalog_item_id,
                    lot_number: data.lot,
                    expiration_date: data.exp,
                    quantity_received: item.quantity_requested, // Reception of full amount for now
                    unit_price: item.estimated_unit_price
                };
            });

            await submitTechnicalReception({
                order_id: order.id,
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
                    <label>Estado del Empaque</label>
                    <select value={packagingStatus} onChange={e => setPackagingStatus(e.target.value)}>
                        <option value="Intacto">✅ Intacto / Buen Estado</option>
                        <option value="Dañado">❌ Dañado / Alterado</option>
                        <option value="Dudoso">⚠️ Dudoso</option>
                    </select>
                </div>
                <div className="form-group">
                    <label>Temperatura al Recibo (°C)</label>
                    <input 
                        type="number" 
                        step="0.1" 
                        value={receptionTemp} 
                        onChange={e => setReceptionTemp(Number(e.target.value))} 
                        required
                    />
                </div>
                <div className="form-group">
                    <label>Resultado Global</label>
                    <select value={isApproved ? "true" : "false"} onChange={e => setIsApproved(e.target.value === "true")}>
                        <option value="true">APROBADO PARA USO</option>
                        <option value="false">EN CUARENTENA / RECHAZADO</option>
                    </select>
                </div>
            </div>

            <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                Detalle de Ítems y Lotes
                <ContextualHelp content={{
                    title: "Inspección de Lotes",
                    description: "Debe verificar físicamente que el lote y la fecha de vencimiento coincidan con el producto entregado.",
                    steps: [
                        "Identifique el lote en la caja o envase.",
                        "Registre la fecha de vencimiento exacta.",
                        "Verifique la integridad del empaque primario."
                    ],
                    tips: ["Si el producto vence en menos de 6 meses, considere marcarlo para uso prioritario o notificar a supervisión."]
                }} />
            </h3>
            
            <div className="table-responsive" style={{ marginBottom: '2rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: 'var(--bg-app)' }}>
                        <tr>
                            <th style={{ padding: '1rem', textAlign: 'left' }}>Producto</th>
                            <th style={{ padding: '1rem', textAlign: 'center' }}>Cant.</th>
                            <th style={{ padding: '1rem', textAlign: 'left' }}>Número de Lote</th>
                            <th style={{ padding: '1rem', textAlign: 'left' }}>Vencimiento</th>
                        </tr>
                    </thead>
                    <tbody>
                        {order.items.map((item) => (
                            <tr key={item.catalog_item_id} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '1rem' }}>
                                    <div style={{ fontWeight: '700' }}>{item.catalog_item.internal_code}</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{item.catalog_item.technical_name}</div>
                                </td>
                                <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 'bold' }}>{item.quantity_requested}</td>
                                <td style={{ padding: '1rem' }}>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <input 
                                            type="text" 
                                            placeholder="LOTE-XXXX"
                                            value={itemData[item.catalog_item_id].lot}
                                            onChange={e => handleItemChange(item.catalog_item_id, 'lot', e.target.value)}
                                            required
                                        />
                                    </div>
                                </td>
                                <td style={{ padding: '1rem' }}>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <input 
                                            type="date"
                                            value={itemData[item.catalog_item_id].exp}
                                            onChange={e => handleItemChange(item.catalog_item_id, 'exp', e.target.value)}
                                            required
                                        />
                                    </div>
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

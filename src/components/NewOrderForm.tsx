"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPurchaseOrder } from "../actions";
import Link from "next/link";

interface Supplier { id: string; name: string; }
interface CatalogItem { id: string; technical_name: string; commercial_name: string; internal_code: string; }

export default function NewOrderForm({ suppliers, items }: { suppliers: Supplier[], items: CatalogItem[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [supplierId, setSupplierId] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  
  const [orderItems, setOrderItems] = useState<{item_id: string; quantity: number; price: number}[]>([]);
  const [selectedItem, setSelectedItem] = useState("");
  const [selectedQty, setSelectedQty] = useState(1);
  const [selectedPrice, setSelectedPrice] = useState(0);

  const totalEstimated = orderItems.reduce((acc, curr) => acc + (curr.quantity * curr.price), 0);

  const handleAddItem = () => {
    if (!selectedItem || selectedQty <= 0) return;
    if (orderItems.some(i => i.item_id === selectedItem)) {
      setError("Este producto ya está en el pedido");
      return;
    }
    setOrderItems([...orderItems, { item_id: selectedItem, quantity: selectedQty, price: selectedPrice }]);
    setSelectedItem("");
    setSelectedQty(1);
    setSelectedPrice(0);
    setError(null);
  };

  const handleRemoveItem = (id: string) => {
    setOrderItems(orderItems.filter(i => i.item_id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId || orderItems.length === 0) {
      setError("Debe seleccionar un proveedor y agregar al menos un producto.");
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("supplier_id", supplierId);
    if (expectedDate) formData.append("expected_delivery_date", expectedDate);
    if (notes) formData.append("notes", notes);
    formData.append("total_estimated_value", totalEstimated.toString());
    formData.append("items", JSON.stringify(orderItems));

    try {
      const res = await createPurchaseOrder(formData);
      if (res.error) {
        setError(res.error);
        setLoading(false);
      } else {
        router.push("/dashboard/pedidos");
        router.refresh();
      }
    } catch (err: any) {
      setError("Error interno al crear el pedido");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="entry-form">
      {error && <div className="error-message">{error}</div>}
      
      <div className="form-group">
        <label>Proveedor Responsable</label>
        <select value={supplierId} onChange={e => setSupplierId(e.target.value)} required>
          <option value="">-- Seleccionar Proveedor --</option>
          {suppliers.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="form-group">
          <label>Fecha Estimada de Entrega (Opcional)</label>
          <input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Notas Adicionales</label>
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ej. Urgente, refrigerado..." />
        </div>
      </div>

      <h3 style={{ marginTop: '2rem', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>Productos Requeridos</h3>
      
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', marginBottom: '1.5rem', background: '#f8fafc', padding: '1rem', borderRadius: '8px' }}>
        <div className="form-group" style={{ flex: 2, marginBottom: 0 }}>
          <label>Producto a Pedir</label>
          <select value={selectedItem} onChange={e => setSelectedItem(e.target.value)}>
            <option value="">-- Buscar Producto --</option>
            {items.map(item => (
              <option key={item.id} value={item.id}>
                {item.internal_code} - {item.commercial_name || item.technical_name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
          <label>Cantidad</label>
          <input type="number" min="1" value={selectedQty} onChange={e => setSelectedQty(Number(e.target.value))} />
        </div>
        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
          <label>Precio Unit. Est. ($)</label>
          <input type="number" step="0.01" min="0" value={selectedPrice} onChange={e => setSelectedPrice(Number(e.target.value))} />
        </div>
        <button type="button" onClick={handleAddItem} className="btn-secondary" style={{ height: '42px', padding: '0 1.5rem' }}>
          Agregar
        </button>
      </div>

      {orderItems.length > 0 ? (
        <table style={{ width: '100%', marginBottom: '2rem', borderCollapse: 'collapse' }}>
          <thead style={{ background: 'var(--bg-app)' }}>
            <tr>
              <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 'bold' }}>Código</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 'bold' }}>Producto</th>
              <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 'bold' }}>Cant.</th>
              <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold' }}>P.Unit</th>
              <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold' }}>Subtotal</th>
              <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 'bold' }}>Quitar</th>
            </tr>
          </thead>
          <tbody>
            {orderItems.map((oi, i) => {
              const fullItem = items.find(x => x.id === oi.item_id);
              return (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.75rem', fontSize: '0.85rem' }}>{fullItem?.internal_code}</td>
                  <td style={{ padding: '0.75rem', fontWeight: '500' }}>{fullItem?.commercial_name || fullItem?.technical_name}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'center' }}>{oi.quantity}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'right' }}>${oi.price.toFixed(2)}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600' }}>${(oi.quantity * oi.price).toFixed(2)}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                    <button type="button" onClick={() => handleRemoveItem(oi.item_id)} style={{ color: 'var(--error)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>
                      &times;
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} style={{ padding: '1rem', textAlign: 'right', fontWeight: '700', fontSize: '1rem' }}>TOTAL ESTIMADO:</td>
              <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '700', fontSize: '1rem', color: 'var(--primary)' }}>${totalEstimated.toFixed(2)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      ) : (
        <div style={{ textAlign: 'center', padding: '2rem', background: '#f8fafc', borderRadius: '8px', color: 'var(--text-muted)', marginBottom: '2rem' }}>
          Aún no has agregado productos al pedido.
        </div>
      )}

      <div className="form-actions" style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
        <Link href="/dashboard/pedidos" className="btn-secondary" style={{ textDecoration: 'none' }}>
          Cancelar
        </Link>
        <button type="submit" className="btn-primary" disabled={loading || orderItems.length === 0}>
          {loading ? "Generando..." : "Crear Pedido"}
        </button>
      </div>
    </form>
  );
}

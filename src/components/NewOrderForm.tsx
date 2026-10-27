"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPurchaseOrder } from "@/app/dashboard/pedidos/actions";
import Link from "next/link";
import SearchableProductSelect from "@/components/SearchableProductSelect";

interface Supplier { id: string; name: string; }
interface CatalogItem { id: string; technical_name: string; commercial_name: string; internal_code: string; supplier_id: string; estimated_unit_price?: number | null; }

export default function NewOrderForm({ suppliers, items }: { suppliers: Supplier[], items: CatalogItem[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [supplierId, setSupplierId] = useState("");
  const [notes, setNotes] = useState("");
  
  const [orderItems, setOrderItems] = useState<{item_id: string; quantity: number; price: number}[]>([]);
  const [selectedItem, setSelectedItem] = useState("");
  const [selectedQty, setSelectedQty] = useState(1);
  const [selectedPrice, setSelectedPrice] = useState(0);
  const supplierItems = supplierId ? items.filter(item => item.supplier_id === supplierId) : [];
  const selectedCatalogItem = items.find(item => item.id === selectedItem);

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
    } catch {
      setError("Error interno al crear el pedido");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="entry-form">
      {error && <div className="error-message">{error}</div>}
      
      <div className="form-group" style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'block' }}>Proveedor Responsable</label>
        <select value={supplierId} onChange={e => { setSupplierId(e.target.value); setOrderItems([]); setSelectedItem(""); setSelectedPrice(0); }} required>
          <option value="">-- Seleccionar Proveedor --</option>
          {suppliers.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <div className="form-row" style={{ gap: '2rem', marginBottom: '2rem' }}>
        <div className="form-group">
          <label style={{ display: 'block' }}>Notas Adicionales</label>
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ej. Urgente, refrigerado..." />
        </div>
      </div>

      <h3 style={{ paddingBottom: '0.5rem', borderBottom: '2px solid var(--primary-light)', color: 'var(--navy)' }}>
        Productos Requeridos
      </h3>
      
      <div className="form-row" style={{ alignItems: 'flex-end', marginBottom: '1.5rem', background: '#f8fafc', padding: '1.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
        <div className="form-group" style={{ flex: 2 }}>
          <label style={{ display: 'block' }}>Producto a Pedir</label>
          <SearchableProductSelect 
            items={supplierItems}
            onSelect={(item) => {
              setSelectedItem(item.id);
              setSelectedPrice(item.estimated_unit_price || 0);
            }}
            placeholder="Escribe nombre o código..."
          />
          {supplierId && supplierItems.length === 0 && <p role="status" className="cell-muted">Este proveedor aún no tiene productos activos asociados. Asócialos desde Configuración.</p>}
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label style={{ display: 'block' }}>Cantidad</label>
          <input type="number" min="1" value={selectedQty} onChange={e => setSelectedQty(Number(e.target.value))} />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label style={{ display: 'block' }}>Precio Unit. Est. ($)</label>
          <input type="number" step="0.01" min="0" value={selectedPrice} onChange={e => setSelectedPrice(Number(e.target.value))} />
          {selectedItem && selectedCatalogItem?.estimated_unit_price == null && <p role="status" className="cell-muted">No hay precio estimado configurado para este producto; ingresa el valor de referencia del pedido.</p>}
        </div>
        <button type="button" onClick={handleAddItem} className="btn-secondary">
          Agregar
        </button>
      </div>

      {orderItems.length > 0 ? (
        <table style={{ width: '100%', marginBottom: '2rem', borderCollapse: 'collapse' }}>
          <thead style={{ background: 'var(--bg-app)' }}>
            <tr>
              <th style={{ textAlign: 'left' }}>Código</th>
              <th style={{ textAlign: 'left' }}>Producto</th>
              <th style={{ textAlign: 'center' }}>Cant.</th>
              <th style={{ textAlign: 'right' }}>P.Unit</th>
              <th style={{ textAlign: 'right' }}>Subtotal</th>
              <th style={{ textAlign: 'center' }}>Quitar</th>
            </tr>
          </thead>
          <tbody>
            {orderItems.map((oi, i) => {
              const fullItem = items.find(x => x.id === oi.item_id);
              return (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td>{fullItem?.internal_code}</td>
                  <td style={{ fontWeight: '500' }}>
                    <div style={{ fontWeight: '600' }}>{fullItem?.technical_name}</div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>{fullItem?.commercial_name}</div>
                  </td>
                  <td style={{ textAlign: 'center' }}>{oi.quantity}</td>
                  <td style={{ textAlign: 'right' }}>${oi.price.toFixed(2)}</td>
                  <td style={{ textAlign: 'right', fontWeight: '600' }}>${(oi.quantity * oi.price).toFixed(2)}</td>
                  <td style={{ textAlign: 'center' }}>
                    <button type="button" onClick={() => handleRemoveItem(oi.item_id)} style={{ color: 'var(--error)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--fs-md)' }}>
                      &times;
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} style={{ textAlign: 'right', fontWeight: 600 }}>TOTAL ESTIMADO:</td>
              <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--primary)' }}>${totalEstimated.toFixed(2)}</td>
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
        <Link href="/dashboard/pedidos" className="btn-secondary">
          Cancelar
        </Link>
        <button type="submit" className="btn-primary" disabled={loading || orderItems.length === 0}>
          {loading ? "Generando..." : "Crear Pedido"}
        </button>
      </div>
    </form>
  );
}

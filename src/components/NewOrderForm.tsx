"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPurchaseOrder } from "@/app/dashboard/pedidos/actions";
import Link from "next/link";
import SearchableProductSelect from "@/components/SearchableProductSelect";
import { formatAmount, formatNumber } from "@/lib/formatters";

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
    <form onSubmit={handleSubmit} className="entry-form purchase-order-form">
      {error && <div className="error-message">{error}</div>}
      
      <div className="form-group purchase-order-supplier">
        <label>Proveedor Responsable</label>
        <select value={supplierId} onChange={e => { setSupplierId(e.target.value); setOrderItems([]); setSelectedItem(""); setSelectedPrice(0); }} required>
          <option value="">-- Seleccionar Proveedor --</option>
          {suppliers.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <div className="form-row purchase-order-notes">
        <div className="form-group">
          <label>Notas Adicionales</label>
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ej. Urgente, refrigerado..." />
        </div>
      </div>

      <h3 className="purchase-order-section-title">
        Productos Requeridos
      </h3>
      
      <div className="form-row purchase-order-builder">
        <div className="form-group purchase-order-product">
          <label>Producto a Pedir</label>
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
        <div className="form-group">
          <label>Cantidad</label>
          <input type="number" min="1" value={selectedQty} onChange={e => setSelectedQty(Number(e.target.value))} />
        </div>
        <div className="form-group">
          <label>Precio Unit. Est. ($)</label>
          <input type="number" step="0.01" min="0" value={selectedPrice} onChange={e => setSelectedPrice(Number(e.target.value))} />
          {selectedItem && selectedCatalogItem?.estimated_unit_price == null && <p role="status" className="cell-muted">No hay precio estimado configurado para este producto; ingresa el valor de referencia del pedido.</p>}
        </div>
        <button type="button" onClick={handleAddItem} className="btn-secondary purchase-order-add">
          Agregar
        </button>
      </div>

      {orderItems.length > 0 ? (
        <div className="table-responsive purchase-order-table-wrap">
        <table className="data-table purchase-order-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Producto</th>
              <th className="cell-center">Cant.</th>
              <th className="cell-right">P.Unit</th>
              <th className="cell-right">Subtotal</th>
              <th className="cell-center">Quitar</th>
            </tr>
          </thead>
          <tbody>
            {orderItems.map((oi, i) => {
              const fullItem = items.find(x => x.id === oi.item_id);
              return (
                <tr key={i}>
                  <td>{fullItem?.internal_code}</td>
                  <td>
                    <div className="purchase-order-item-name">{fullItem?.technical_name}</div>
                    <div className="cell-muted">{fullItem?.commercial_name}</div>
                  </td>
                  <td className="cell-center">{formatNumber(oi.quantity)}</td>
                  <td className="cell-right">${formatAmount(oi.price)}</td>
                  <td className="cell-right purchase-order-subtotal">${formatAmount(oi.quantity * oi.price)}</td>
                  <td className="cell-center">
                    <button type="button" onClick={() => handleRemoveItem(oi.item_id)} className="purchase-order-remove" aria-label={`Quitar ${fullItem?.technical_name || 'producto'} del pedido`}>
                      &times;
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} className="cell-right purchase-order-total-label">TOTAL ESTIMADO:</td>
              <td className="cell-right purchase-order-total">${formatAmount(totalEstimated)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
        </div>
      ) : (
        <div className="purchase-order-empty">
          Aún no has agregado productos al pedido.
        </div>
      )}

      <div className="form-actions purchase-order-actions">
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

"use client";

import { useState } from "react";

interface SupplierOption { id: string; name: string; contact_email?: string | null; }

export default function SupplierEvaluationFields({ suppliers }: { suppliers: SupplierOption[] }) {
  const [supplierId, setSupplierId] = useState("");
  const selected = suppliers.find(supplier => supplier.id === supplierId);
  const [email, setEmail] = useState("");

  return <div className="form-fields evaluation-supplier-fields">
    <div>
      <label className="form-label" htmlFor="evaluation-supplier">Proveedor *</label>
      <select id="evaluation-supplier" name="supplier_id" required className="form-select" value={supplierId} onChange={event => {
        const id = event.target.value;
        setSupplierId(id);
        setEmail(suppliers.find(supplier => supplier.id === id)?.contact_email || "");
      }}>
        <option value="">Seleccione un proveedor...</option>
        {suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
      </select>
    </div>
    <div>
      <label className="form-label" htmlFor="supplier-email">Correo electrónico del proveedor *</label>
      <input id="supplier-email" type="email" name="supplier_email" required className="form-input" value={email} onChange={event => setEmail(event.target.value)} placeholder={selected?.contact_email || "contacto@proveedor.com"} />
    </div>
  </div>;
}

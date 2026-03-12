'use client';

import { useRouter } from 'next/navigation';

interface Product {
  id: string;
  technical_name: string;
  commercial_name?: string | null;
  internal_code: string;
}

export default function InventoryProductSelector({ 
  products, 
  currentId 
}: { 
  products: Product[]; 
  currentId?: string;
}) {
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val) {
      router.push(`?view=entradas&editId=${val}`);
    } else {
      router.push(`?view=entradas`);
    }
  };

  return (
    <div style={{ padding: '1.5rem', background: 'var(--primary-light)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <label style={{ fontSize: '0.875rem', fontWeight: '700', color: 'var(--primary)' }}>Buscar Producto Existente:</label>
      <select 
        style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'white' }}
        onChange={handleChange}
        value={currentId || ""}
      >
        <option value="">-- Seleccionar para cargar datos --</option>
        {products.map(item => (
          <option key={item.id} value={item.id}>
            {item.technical_name} {item.commercial_name ? `(${item.commercial_name})` : ''} - {item.internal_code}
          </option>
        ))}
      </select>
    </div>
  );
}

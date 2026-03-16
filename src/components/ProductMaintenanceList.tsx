"use client";

import { useState } from "react";
import DeleteMasterButton from "./DeleteMasterButton";

interface CatalogItem {
  id: string;
  internal_code: string;
  technical_name: string;
  commercial_name: string | null;
  section_id: string;
  purchase_unit: string | null;
  minimum_stock_threshold: number | null;
  estimated_unit_price: number | null;
  is_active: boolean;
}

interface ProductMaintenanceListProps {
  initialItems: CatalogItem[];
  toggleStatusAction: (id: string, currentStatus: boolean, type: 'product') => Promise<void>;
  handleDeleteAction: (id: string, type: 'product') => Promise<void>;
}

export default function ProductMaintenanceList({ 
  initialItems, 
  toggleStatusAction, 
  handleDeleteAction 
}: ProductMaintenanceListProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const displayItems = initialItems.filter(item => {
    const s = searchTerm.toLowerCase();
    return (
      item.technical_name.toLowerCase().includes(s) ||
      item.internal_code.toLowerCase().includes(s) ||
      (item.commercial_name && item.commercial_name.toLowerCase().includes(s))
    );
  });

  return (
    <>
      <div style={{ padding: '0 1.5rem 1rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
        <div style={{ position: 'relative', maxWidth: '400px' }}>
          <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', display: 'flex' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          </span>
          <input 
            type="text" 
            placeholder="Escribe el nombre para buscar..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '0.75rem 0.75rem 0.75rem 2.8rem', 
              borderRadius: '12px', 
              border: '1px solid var(--border)',
              fontSize: '0.925rem',
              outline: 'none',
              transition: 'border-color 0.2s',
              background: 'white'
            }}
            onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
          />
        </div>
      </div>
      
      <div className="table-responsive">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)', background: '#f8fafc' }}>
              <th style={{ padding: '1rem', fontSize: '0.8rem', fontWeight: '700', color: 'var(--navy-light)', textTransform: 'uppercase' }}>Código</th>
              <th style={{ padding: '1rem', fontSize: '0.8rem', fontWeight: '700', color: 'var(--navy-light)', textTransform: 'uppercase' }}>Producto</th>
              <th style={{ padding: '1rem', fontSize: '0.8rem', fontWeight: '700', color: 'var(--navy-light)', textTransform: 'uppercase' }}>Presentación</th>
              <th style={{ padding: '1rem', fontSize: '0.8rem', fontWeight: '700', color: 'var(--navy-light)', textTransform: 'uppercase', textAlign: 'right' }}>P. Estimado</th>
              <th style={{ padding: '1rem', fontSize: '0.8rem', fontWeight: '700', color: 'var(--navy-light)', textTransform: 'uppercase' }}>Estado</th>
              <th style={{ padding: '1rem', fontSize: '0.8rem', fontWeight: '700', color: 'var(--navy-light)', textTransform: 'uppercase', textAlign: 'center' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {displayItems.map(i => (
              <tr key={i.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }} className="hover-row">
                <td style={{ padding: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{i.internal_code}</td>
                <td style={{ padding: '1rem', fontWeight: '700', color: 'var(--navy)' }}>{i.technical_name}</td>
                <td style={{ padding: '1rem' }}>{i.commercial_name || "-"}</td>
                <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '700', color: 'var(--primary)' }}>
                  ${i.estimated_unit_price?.toFixed(2) || "0.00"}
                </td>
                <td style={{ padding: '1rem' }}>
                  <span style={{ 
                    padding: '0.25rem 0.75rem', 
                    borderRadius: '20px', 
                    fontSize: '0.7rem', 
                    fontWeight: '800',
                    background: i.is_active ? '#dcfce7' : '#fee2e2', 
                    color: i.is_active ? '#166534' : '#991b1b' 
                  }}>
                    {i.is_active ? 'ACTIVO' : 'INACTIVO'}
                  </span>
                </td>
                <td style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                    <a href={`?tab=productos&editId=${i.id}`} style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', border: '1px solid var(--border)', borderRadius: '8px', textDecoration: 'none', color: 'var(--navy)', fontWeight: '600', background: 'white' }}>Editar</a>
                    <form action={async () => {
                      await toggleStatusAction(i.id, !!i.is_active, 'product');
                    }}>
                      <button type="submit" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px', color: i.is_active ? 'var(--error)' : 'var(--success)', cursor: 'pointer', fontWeight: '600' }}>
                        {i.is_active ? 'Inactivar' : 'Activar'}
                      </button>
                    </form>
                    <DeleteMasterButton onDelete={async () => {
                      if (confirm(`¿Seguro quieres eliminar el producto "${i.technical_name}"?`)) {
                        await handleDeleteAction(i.id, 'product');
                      }
                    }} />
                  </div>
                </td>
              </tr>
            ))}
            {displayItems.length === 0 && (
              <tr><td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No se encontraron productos que coincidan con la búsqueda.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <style jsx>{`
        .hover-row:hover {
          background-color: var(--bg-app);
        }
      `}</style>
    </>
  );
}

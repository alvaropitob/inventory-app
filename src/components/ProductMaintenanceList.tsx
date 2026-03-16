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
      <div style={{ padding: '0 1.5rem 1.5rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
        <div className="form-group" style={{ maxWidth: '450px', position: 'relative' }}>
          <span style={{ position: 'absolute', left: '1rem', top: '1.4rem', color: 'var(--text-muted)', zIndex: 1 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          </span>
          <input 
            type="text" 
            placeholder="Buscar por nombre, código o presentación..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '3rem' }}
          />
        </div>
      </div>
      
      <div className="table-responsive">
        <table className="table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Producto</th>
              <th>Presentación</th>
              <th style={{ textAlign: 'right' }}>P. Estimado</th>
              <th style={{ textAlign: 'center' }}>Estado</th>
              <th style={{ textAlign: 'center' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {displayItems.map(i => (
              <tr key={i.id}>
                <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{i.internal_code}</td>
                <td style={{ fontWeight: '700', color: 'var(--navy)' }}>{i.technical_name}</td>
                <td>{i.commercial_name || "-"}</td>
                <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--primary)' }}>
                  ${i.estimated_unit_price?.toFixed(2) || "0.00"}
                </td>
                <td style={{ textAlign: 'center' }}>
                  <span className={i.is_active ? 'badge badge-success' : 'badge badge-error'}>
                    {i.is_active ? 'ACTIVO' : 'INACTIVO'}
                  </span>
                </td>
                <td style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                    <a href={`?tab=productos&editId=${i.id}`} className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}>Editar</a>
                    <form action={async () => {
                      await toggleStatusAction(i.id, !!i.is_active, 'product');
                    }}>
                      <button type="submit" className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', color: i.is_active ? 'var(--error)' : 'var(--success)' }}>
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

"use client";

import { useState, useRef, useEffect } from "react";

interface Product {
  id: string;
  technical_name: string;
  commercial_name: string;
  internal_code: string;
  estimated_unit_price?: number;
}

interface SearchableProductSelectProps {
  items: Product[];
  onSelect: (item: Product) => void;
  placeholder?: string;
}

export default function SearchableProductSelect({ items, onSelect, placeholder = "Buscar producto..." }: SearchableProductSelectProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredItems = items.filter(item => {
    const s = searchTerm.toLowerCase();
    return (
      item.technical_name.toLowerCase().includes(s) ||
      item.internal_code.toLowerCase().includes(s) ||
      (item.commercial_name && item.commercial_name.toLowerCase().includes(s))
    );
  });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <input 
        type="text" 
        placeholder={placeholder}
        value={searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        style={{ 
          width: '100%', 
          padding: '0.75rem', 
          borderRadius: '8px', 
          border: '1px solid var(--border)',
          fontSize: '0.925rem',
          outline: 'none',
          background: 'white'
        }}
      />
      
      {isOpen && searchTerm.length > 0 && (
        <div style={{ 
          position: 'absolute', 
          top: '100%', 
          left: 0, 
          right: 0, 
          zIndex: 1000, 
          maxHeight: '300px', 
          overflowY: 'auto', 
          background: 'white', 
          border: '1px solid var(--border)', 
          borderRadius: '0 0 8px 8px', 
          boxShadow: 'var(--shadow-lg)' 
        }}>
          {filteredItems.length > 0 ? (
            filteredItems.map(item => (
              <div 
                key={item.id} 
                onClick={() => {
                  onSelect(item);
                  setSearchTerm("");
                  setIsOpen(false);
                }}
                style={{ 
                  padding: '0.75rem 1rem', 
                  cursor: 'pointer', 
                  borderBottom: '1px solid var(--border-light)',
                }}
                className="product-suggestion"
              >
                <div style={{ fontWeight: '600', color: 'var(--navy)', fontSize: '0.9rem' }}>{item.technical_name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {item.commercial_name} <span style={{ marginLeft: '0.5rem', fontWeight: 'bold' }}>[{item.internal_code}]</span>
                </div>
              </div>
            ))
          ) : (
            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              No se encontraron productos
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .product-suggestion:hover {
          background-color: var(--bg-app);
        }
        .product-suggestion:last-child {
          border-bottom: none;
        }
      `}</style>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Batch {
  id: string;
  item_id: string;
  batch_number: string;
  expiration_date: string;
  current_stock: number;
  item?: { technical_name: string; commercial_name: string; internal_code: string; minimum_stock_threshold?: number } | null;
  location?: { name: string } | null;
  clinical_status?: string;
}

interface GroupedItem {
  technical_name: string;
  commercial_name: string;
  internal_code: string;
  minimum_stock_threshold?: number;
  id: string;
  totalStock: number;
  itemBatches: Batch[];
}

export default function RealtimeStockTable({ initialBatches }: { initialBatches: Batch[] }) {
  const [batches, setBatches] = useState(initialBatches);
  const supabase = createClient();

  useEffect(() => {
    const channel = supabase
      .channel('inventory_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inventory_batches' },
        (payload) => {
          console.log('Realtime change detected:', payload);
          // Refresh data or update local state
          // For simplicity and correctness (to get joined data), we can trigger a re-fetch or just update simple fields
          // A more robust way is to revalidate the server component, but for "live" feel, local state update is better.
          if (payload.eventType === 'UPDATE') {
            setBatches(current => 
              current.map(b => b.id === payload.new.id ? { ...b, ...payload.new } : b)
            );
          } else if (payload.eventType === 'INSERT') {
             // For inserts, we'd need to fetch the joined item/location data
             // To keep it simple for this demo, we'll just log and suggest a refresh or fetch the single item
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  // Grouping logic (simplified)
  const groupedStock = batches.reduce((acc: Record<string, GroupedItem>, batch) => {
    const itemId = batch.item_id;
    if (!acc[itemId]) {
      acc[itemId] = {
        technical_name: batch.item?.technical_name || '',
        commercial_name: batch.item?.commercial_name || '',
        internal_code: batch.item?.internal_code || '',
        minimum_stock_threshold: batch.item?.minimum_stock_threshold,
        id: itemId,
        totalStock: 0,
        itemBatches: []
      };
    }
    acc[itemId].totalStock += batch.current_stock;
    acc[itemId].itemBatches.push(batch);
    return acc;
  }, {});

  const sortedStock = Object.values(groupedStock).sort((a: GroupedItem, b: GroupedItem) => 
    (a.technical_name || '').localeCompare(b.technical_name || '')
  );

  return (
    <div className="table-responsive">
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
            <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', width: '12%' }}>Código</th>
            <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', width: '30%' }}>Producto</th>
            <th style={{ padding: '1rem', textAlign: 'center', fontSize: '0.75rem', width: '15%' }}>Stock Total</th>
            <th style={{ padding: '1rem', textAlign: 'center', fontSize: '0.75rem', width: '15%' }}>Lote / Desglose</th>
            <th style={{ padding: '1rem', textAlign: 'center', fontSize: '0.75rem', width: '13%' }}>Estado</th>
          </tr>
        </thead>
        <tbody>
          {sortedStock.map((item: GroupedItem) => {
            const isLowStock = item.totalStock <= (item.minimum_stock_threshold || 10);
            const isOutOfStock = item.totalStock === 0;
            
            return (
              <tr key={item.id} style={{ borderBottom: '1px solid var(--border)', background: isOutOfStock ? '#fff1f2' : 'transparent' }}>
                <td style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{item.internal_code}</td>
                <td style={{ padding: '1rem' }}>
                  <div style={{ fontWeight: '700', color: 'var(--navy)', fontSize: '0.9rem' }}>{item.technical_name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.commercial_name}</div>
                </td>
                <td style={{ padding: '1rem', textAlign: 'center' }}>
                  <span style={{ 
                    fontSize: '1.25rem', 
                    fontWeight: '800', 
                    color: isOutOfStock ? 'var(--error)' : isLowStock ? 'var(--warning)' : 'var(--success)' 
                  }}>
                    {item.totalStock}
                  </span>
                </td>
                <td style={{ padding: '1rem', fontSize: '0.75rem' }}>
                  {item.itemBatches.filter((b: Batch) => b.current_stock > 0).map((b: Batch) => (
                    <div key={b.id} style={{ marginBottom: '0.4rem', padding: '0.4rem', background: 'rgba(0,0,0,0.02)', borderRadius: '6px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{b.batch_number}: <strong>{b.current_stock}</strong></span>
                      <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Vence: {new Date(b.expiration_date).toLocaleDateString()}</span>
                    </div>
                  ))}
                </td>
                <td style={{ padding: '1rem', textAlign: 'center' }}>
                    {isOutOfStock ? (
                      <span style={{ padding: '0.3rem 0.6rem', borderRadius: '12px', fontSize: '0.7rem', fontWeight: '700', background: '#fee2e2', color: '#991b1b' }}>AGOTADO</span>
                    ) : isLowStock ? (
                      <span style={{ padding: '0.3rem 0.6rem', borderRadius: '12px', fontSize: '0.7rem', fontWeight: '700', background: '#fef3c7', color: '#92400e' }}>BAJO</span>
                    ) : (
                      <span style={{ padding: '0.3rem 0.6rem', borderRadius: '12px', fontSize: '0.7rem', fontWeight: '700', background: '#dcfce7', color: '#166534' }}>ÓPTIMO</span>
                    )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ padding: '0.5rem', fontSize: '0.65rem', color: 'var(--success)', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.25rem' }}>
        <span style={{ width: '6px', height: '6px', background: 'var(--success)', borderRadius: '50%', display: 'inline-block' }}></span>
        Monitoreo en tiempo real activo
      </div>
    </div>
  );
}

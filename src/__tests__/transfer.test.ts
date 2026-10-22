import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StockService } from '@/lib/services/stock';
import { createClient } from '@/lib/supabase/server';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

describe('StockService - transferStock', () => {
  const mockSupabase = {
    rpc: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (createClient as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue(mockSupabase);
  });

  it('returns the database error when the destination matches the source', async () => {
    const transferError = { message: 'Destination must differ from source location' };
    mockSupabase.rpc.mockResolvedValueOnce({ error: transferError });

    const result = await StockService.transferStock({
      batch_id: 'batch-123',
      destination_location_id: 'loc-origin',
      quantity: 5,
      transferred_by: 'user-123',
    });

    expect(result.data).toBeNull();
    expect(result.error).toEqual(transferError);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('fn_transfer_inventory_batch', expect.objectContaining({
      p_batch_id: 'batch-123',
      p_destination_location_id: 'loc-origin',
    }));
  });

  it('returns the database error when the quantity exceeds available stock', async () => {
    const transferError = { message: 'Insufficient source stock; available: 5' };
    mockSupabase.rpc.mockResolvedValueOnce({ error: transferError });

    const result = await StockService.transferStock({
      batch_id: 'batch-123',
      destination_location_id: 'loc-dest',
      quantity: 10,
      transferred_by: 'user-123',
    });

    expect(result.data).toBeNull();
    expect(result.error).toEqual(transferError);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('fn_transfer_inventory_batch', expect.objectContaining({
      p_batch_id: 'batch-123',
      p_quantity: 10,
    }));
  });
});

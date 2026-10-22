import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StockService } from '@/lib/services/stock';
import { createClient } from '@/lib/supabase/server';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

describe('StockService', () => {
  const mockSupabase = {
    rpc: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (createClient as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue(mockSupabase);
  });

  describe('consumeStock', () => {
    it('returns the database error when stock is insufficient', async () => {
      const stockError = { message: 'Insufficient stock; available: 5' };
      mockSupabase.rpc.mockResolvedValueOnce({ error: stockError });

      const result = await StockService.consumeStock({
        batch_id: 'batch-1',
        quantity: 10,
        consumed_by: 'user-1',
        reason: 'Usage',
      });

      expect(result.data).toBeNull();
      expect(result.error).toEqual(stockError);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('fn_consume_inventory_batch', expect.objectContaining({
        p_batch_id: 'batch-1',
        p_quantity: 10,
      }));
    });

    it('consumes stock through the atomic database function', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({ error: null });

      const result = await StockService.consumeStock({
        batch_id: 'batch-1',
        quantity: 10,
        consumed_by: 'user-1',
        reason: 'Usage',
      });

      expect(result.data?.success).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('fn_consume_inventory_batch', expect.objectContaining({
        p_batch_id: 'batch-1',
        p_quantity: 10,
      }));
    });
  });
});

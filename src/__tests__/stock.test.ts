import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StockService } from '@/lib/services/stock';
import { createClient } from '@/lib/supabase/server';

// Mock Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

describe('StockService', () => {
  const mockSupabase = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockReturnThis(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (createClient as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue(mockSupabase);
  });

  describe('consumeStock', () => {
    it('should fail if stock is insufficient', async () => {
      mockSupabase.single.mockResolvedValueOnce({ 
        data: { current_stock: 5, batch_number: 'B-001' }, 
        error: null 
      });

      const result = await StockService.consumeStock({
        batch_id: 'batch-1',
        quantity: 10,
        consumed_by: 'user-1',
        reason: 'Usage',
      });

      expect(result.data).toBeNull();
      expect(result.error?.message).toContain('Stock insuficiente');
    });

    it('should create a stock movement if stock is sufficient', async () => {
      mockSupabase.single.mockResolvedValueOnce({ 
        data: { current_stock: 50, batch_number: 'B-001' }, 
        error: null 
      });
      mockSupabase.insert.mockResolvedValueOnce({ error: null });

      const result = await StockService.consumeStock({
        batch_id: 'batch-1',
        quantity: 10,
        consumed_by: 'user-1',
        reason: 'Usage',
      });

      expect(result.data?.success).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('stock_movements');
      expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({
        movement_type: 'exit',
        quantity: 10,
      }));
    });
  });
});

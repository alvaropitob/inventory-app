import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ComplianceService } from '@/lib/services/compliance';
import { createClient } from '@/lib/supabase/server';

// Mock Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

describe('ComplianceService', () => {
  const mockSupabase = {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (createClient as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue(mockSupabase);
  });

  describe('getSuggestedLot', () => {
    it('should return a lot based on FEFO (First Expired First Out)', async () => {
      const mockLot = { id: 'lot-1', expiration_date: '2025-12-31' };
      mockSupabase.single.mockResolvedValueOnce({ data: mockLot, error: null });

      const result = await ComplianceService.getSuggestedLot('item-123');

      expect(mockSupabase.from).toHaveBeenCalledWith('inventory_batches');
      expect(mockSupabase.eq).toHaveBeenCalledWith('clinical_status', 'accepted');
      expect(mockSupabase.order).toHaveBeenCalledWith('expiration_date', { ascending: true });
      expect(result).toEqual(mockLot);
    });

    it('should return null and warn if no lot is found', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await ComplianceService.getSuggestedLot('item-123');

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('reportSafetyIncident', () => {
    it('should block a batch if the incident is a recall', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } } });
      mockSupabase.single.mockResolvedValueOnce({ data: { id: 'incident-1' }, error: null });
      mockSupabase.update.mockReturnThis();
      mockSupabase.eq.mockResolvedValueOnce({ error: null });

      await ComplianceService.reportSafetyIncident({
        batch_id: 'batch-1',
        incident_type: 'recall',
        description: 'Dangerous defect',
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('inventory_batches');
      expect(mockSupabase.update).toHaveBeenCalledWith({ clinical_status: 'rejected' });
    });
  });
});

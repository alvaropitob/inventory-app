import { describe, it, expect, vi, beforeEach } from "vitest";
import { StockService } from "@/lib/services/stock";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

describe("StockService - transferStock", () => {
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

  it("should prevent transfer if destination location is the same as origin location", async () => {
    mockSupabase.single.mockResolvedValueOnce({
      data: {
        id: "batch-123",
        location_id: "loc-origin",
        current_stock: 10,
        locations: { name: "Nevera 1" },
      },
      error: null,
    });

    const result = await StockService.transferStock({
      batch_id: "batch-123",
      destination_location_id: "loc-origin",
      quantity: 5,
      transferred_by: "user-123",
    });

    expect(result.data).toBeNull();
    expect(result.error).toEqual({
      message: "La ubicación destino debe ser diferente a la ubicación actual.",
    });
  });

  it("should prevent transfer if quantity exceeds available stock", async () => {
    mockSupabase.single.mockResolvedValueOnce({
      data: {
        id: "batch-123",
        location_id: "loc-origin",
        current_stock: 5,
        locations: { name: "Nevera 1" },
      },
      error: null,
    });

    const result = await StockService.transferStock({
      batch_id: "batch-123",
      destination_location_id: "loc-dest",
      quantity: 10,
      transferred_by: "user-123",
    });

    expect(result.data).toBeNull();
    expect(result.error).toEqual({
      message: "Stock insuficiente para trasladar. Disponible: 5 unidades.",
    });
  });
});

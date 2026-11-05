import { describe, expect, it } from "vitest";
import { getInventoryStockPriority } from "@/lib/inventory-stock-priority";

describe("getInventoryStockPriority", () => {
  it("does not alert for catalog-only products", () => {
    expect(getInventoryStockPriority({
      inventoryControlEnabled: false,
      totalStock: 0,
      minimumStock: 1,
      maximumStock: null,
    })).toBe("none");
  });

  it("flags a controlled product with no stock as critical", () => {
    expect(getInventoryStockPriority({
      inventoryControlEnabled: true,
      totalStock: 0,
      minimumStock: 0,
      maximumStock: null,
    })).toBe("high");
  });

  it("flags controlled stock below its minimum", () => {
    expect(getInventoryStockPriority({
      inventoryControlEnabled: true,
      totalStock: 2,
      minimumStock: 3,
      maximumStock: null,
    })).toBe("medium");
  });

  it("flags controlled stock above its maximum", () => {
    expect(getInventoryStockPriority({
      inventoryControlEnabled: true,
      totalStock: 6,
      minimumStock: 1,
      maximumStock: 5,
    })).toBe("low");
  });

  it("does not alert for controlled stock within configured limits", () => {
    expect(getInventoryStockPriority({
      inventoryControlEnabled: true,
      totalStock: 4,
      minimumStock: 2,
      maximumStock: 6,
    })).toBe("none");
  });
});

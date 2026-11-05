export type InventoryStockPriority = "none" | "low" | "medium" | "high";

export interface InventoryStockThresholds {
  inventoryControlEnabled: boolean;
  totalStock: number;
  minimumStock: number;
  maximumStock: number | null;
}

export function getInventoryStockPriority({
  inventoryControlEnabled,
  totalStock,
  minimumStock,
  maximumStock,
}: InventoryStockThresholds): InventoryStockPriority {
  if (!inventoryControlEnabled) return "none";
  if (totalStock <= 0) return "high";
  if (minimumStock > 0 && totalStock < minimumStock) return "medium";
  if (maximumStock !== null && totalStock > maximumStock) return "low";
  if (minimumStock > 0 && totalStock < minimumStock * 1.5) return "low";
  return "none";
}

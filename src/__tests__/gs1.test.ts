import { describe, it, expect } from "vitest";
import { parseGS1Barcode } from "@/lib/utils/gs1";

describe("GS1-128 Barcode Parser", () => {
  it("should parse standard parenthesis GS1 barcode with SKU, Lot and Expiration", () => {
    const raw = "(01)07701234567890(17)261231(10)LOT98765";
    const result = parseGS1Barcode(raw);

    expect(result.gtin).toBe("07701234567890");
    expect(result.lotNumber).toBe("LOT98765");
    expect(result.expirationDate).toBe("2026-12-31");
  });

  it("should parse continuous GS1 barcode without parenthesis", () => {
    // 01 + 14 chars GTIN + 17 + 6 chars Date (270630 -> 2027-06-30) + 10 + Lot
    const raw = "01077099988877761727063010BATCH-ROCHE-01";
    const result = parseGS1Barcode(raw);

    expect(result.gtin).toBe("07709998887776");
    expect(result.expirationDate).toBe("2027-06-30");
    expect(result.lotNumber).toBe("BATCH-ROCHE-01");
  });

  it("should fallback gracefully if only a raw lot or SKU is passed", () => {
    const raw = "LOT-HEMATO-2026";
    const result = parseGS1Barcode(raw);

    expect(result.lotNumber).toBe("LOT-HEMATO-2026");
    expect(result.expirationDate).toBeNull();
  });
});

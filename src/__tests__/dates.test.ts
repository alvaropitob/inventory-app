import { describe, expect, it } from "vitest";
import { formatDateKeyInBusinessTimeZone, getDateKeyInBusinessTimeZone, getDaysUntilDateKey, getYearInBusinessTimeZone, getYearMonthInBusinessTimeZone, isValidDateKey } from "@/lib/dates";

describe("business timezone dates", () => {
  it("keeps timestamps before Bogotá midnight on the previous date", () => {
    expect(getDateKeyInBusinessTimeZone("2026-01-01T04:59:59.999Z")).toBe("2025-12-31");
  });

  it("switches dates at Bogotá midnight", () => {
    expect(getDateKeyInBusinessTimeZone("2026-01-01T05:00:00.000Z")).toBe("2026-01-01");
  });

  it("derives year and month in Bogotá, including year rollover", () => {
    const date = new Date("2026-01-01T04:59:59.999Z");
    expect(getYearMonthInBusinessTimeZone(date)).toBe("2025-12");
    expect(getYearInBusinessTimeZone(date)).toBe(2025);
  });

  it("calculates expiration days using Bogotá calendar dates", () => {
    const now = new Date("2026-10-21T05:30:00.000Z");
    expect(getDaysUntilDateKey("2026-10-20", now)).toBe(-1);
    expect(getDaysUntilDateKey("2026-10-21", now)).toBe(0);
    expect(getDaysUntilDateKey("2026-10-22", now)).toBe(1);
  });

  it("validates calendar dates including leap days", () => {
    expect(isValidDateKey("2024-02-29")).toBe(true);
    expect(isValidDateKey("2026-02-29")).toBe(false);
    expect(isValidDateKey("2026-13-01")).toBe(false);
    expect(isValidDateKey("21-10-2026")).toBe(false);
  });

  it("formats date-only values without shifting them to the prior day", () => {
    expect(formatDateKeyInBusinessTimeZone("2026-10-22")).toBe("22/10/2026");
    expect(formatDateKeyInBusinessTimeZone(null)).toBe("N/A");
  });
});

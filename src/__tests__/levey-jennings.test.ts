import { describe, expect, it } from "vitest";
import {
  calculateLeveyJenningsParams,
  calculateChartScale,
  getYCoordinate,
  getXCoordinate,
  getReadingPointColor,
  isTemperatureOutOfRange,
} from "@/lib/utils/levey-jennings";

describe("Levey-Jennings Chart Logic & Calculations", () => {
  describe("calculateLeveyJenningsParams", () => {
    it("correctly calculates Media, SD and 7 control lines for refrigerated storage (2–8 °C)", () => {
      const params = calculateLeveyJenningsParams(2, 8);
      expect(params).not.toBeNull();
      if (!params) return;

      // Media = (2 + 8) / 2 = 5.0 °C
      expect(params.mean).toBe(5.0);
      // 1 DE = (8 - 2) / 6 = 1.0 °C
      expect(params.sd).toBe(1.0);

      const lineMap = Object.fromEntries(params.lines.map((l) => [l.label, l.value]));
      expect(lineMap["+3 DE"]).toBe(8.0);
      expect(lineMap["+2 DE"]).toBe(7.0);
      expect(lineMap["+1 DE"]).toBe(6.0);
      expect(lineMap["Media"]).toBe(5.0);
      expect(lineMap["−1 DE"]).toBe(4.0);
      expect(lineMap["−2 DE"]).toBe(3.0);
      expect(lineMap["−3 DE"]).toBe(2.0);
    });

    it("correctly calculates Media, SD and lines for room temperature (15–25 °C)", () => {
      const params = calculateLeveyJenningsParams(15, 25);
      expect(params).not.toBeNull();
      if (!params) return;

      expect(params.mean).toBe(20.0);
      expect(params.sd).toBeCloseTo(10 / 6, 4);

      const lineMap = Object.fromEntries(params.lines.map((l) => [l.label, l.value]));
      expect(lineMap["+3 DE"]).toBe(25.0);
      expect(lineMap["Media"]).toBe(20.0);
      expect(lineMap["−3 DE"]).toBe(15.0);
    });

    it("correctly handles negative temperatures for frozen storage (−25 to −15 °C)", () => {
      const params = calculateLeveyJenningsParams(-25, -15);
      expect(params).not.toBeNull();
      if (!params) return;

      expect(params.mean).toBe(-20.0);
      expect(params.sd).toBeCloseTo(10 / 6, 4);

      const lineMap = Object.fromEntries(params.lines.map((l) => [l.label, l.value]));
      expect(lineMap["+3 DE"]).toBe(-15.0);
      expect(lineMap["Media"]).toBe(-20.0);
      expect(lineMap["−3 DE"]).toBe(-25.0);
    });

    it("returns null when min or max are missing, invalid, or min >= max", () => {
      expect(calculateLeveyJenningsParams(null, 8)).toBeNull();
      expect(calculateLeveyJenningsParams(2, null)).toBeNull();
      expect(calculateLeveyJenningsParams(8, 2)).toBeNull();
      expect(calculateLeveyJenningsParams(5, 5)).toBeNull();
      expect(calculateLeveyJenningsParams(Number.NaN, 8)).toBeNull();
    });
  });

  describe("calculateChartScale", () => {
    it("adds proportional padding beyond the observed and configured limits", () => {
      const scale = calculateChartScale([4, 5, 6], 2, 8);
      // Min extent is 2, max extent is 8. Range is 6. Padding = 6 * 0.12 = 0.72
      expect(scale.observedMin).toBe(2);
      expect(scale.observedMax).toBe(8);
      expect(scale.scaleMin).toBeCloseTo(2 - 0.72, 2);
      expect(scale.scaleMax).toBeCloseTo(8 + 0.72, 2);
    });

    it("expands scale when an observed reading is outside configured limits", () => {
      const scale = calculateChartScale([1.0, 9.5], 2, 8);
      expect(scale.observedMin).toBe(1.0);
      expect(scale.observedMax).toBe(9.5);
      expect(scale.scaleMin).toBeLessThan(1.0);
      expect(scale.scaleMax).toBeGreaterThan(9.5);
    });

    it("handles empty readings gracefully using default scale", () => {
      const scale = calculateChartScale([], null, null);
      expect(scale.scaleMin).toBeLessThan(scale.scaleMax);
    });
  });

  describe("getYCoordinate and getXCoordinate SVG projections", () => {
    it("projects maximum temperature to the top and minimum temperature to the bottom", () => {
      const plotTop = 34;
      const plotBottom = 265;
      const scaleMin = 0;
      const scaleMax = 10;

      const yMax = getYCoordinate(scaleMax, scaleMin, scaleMax, plotTop, plotBottom);
      expect(yMax).toBe(plotTop);

      const yMin = getYCoordinate(scaleMin, scaleMin, scaleMax, plotTop, plotBottom);
      expect(yMin).toBe(plotBottom);

      const yMid = getYCoordinate(5, scaleMin, scaleMax, plotTop, plotBottom);
      expect(yMid).toBe((plotTop + plotBottom) / 2);
    });

    it("positions multiple readings proportionally along the X-axis from left to right", () => {
      const plotLeft = 100;
      const plotRight = 900;
      const total = 5;

      expect(getXCoordinate(0, total, plotLeft, plotRight)).toBe(100);
      expect(getXCoordinate(2, total, plotLeft, plotRight)).toBe(500);
      expect(getXCoordinate(4, total, plotLeft, plotRight)).toBe(900);
    });

    it("centers a single reading horizontally", () => {
      const plotLeft = 100;
      const plotRight = 900;
      expect(getXCoordinate(0, 1, plotLeft, plotRight)).toBe(500);
    });
  });

  describe("point color & range classification", () => {
    it("classifies points correctly as in-range or out-of-range", () => {
      expect(isTemperatureOutOfRange(5.0, 2, 8)).toBe(false);
      expect(isTemperatureOutOfRange(2.0, 2, 8)).toBe(false);
      expect(isTemperatureOutOfRange(8.0, 2, 8)).toBe(false);
      expect(isTemperatureOutOfRange(1.9, 2, 8)).toBe(true);
      expect(isTemperatureOutOfRange(8.1, 2, 8)).toBe(true);
    });

    it("assigns clinical color scheme (Red for alert, Teal for AM, Blue for PM)", () => {
      // Out of range is always Red (#dc2626) regardless of shift
      expect(getReadingPointColor(true, "am")).toBe("#dc2626");
      expect(getReadingPointColor(true, "pm")).toBe("#dc2626");

      // In range: AM is Teal (#0f766e)
      expect(getReadingPointColor(false, "am")).toBe("#0f766e");

      // In range: PM is Blue (#2563eb)
      expect(getReadingPointColor(false, "pm")).toBe("#2563eb");
    });
  });
});


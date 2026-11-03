export interface LeveyJenningsLine {
  label: string;
  value: number;
}

export interface LeveyJenningsParams {
  mean: number;
  sd: number;
  lines: LeveyJenningsLine[];
}

export interface ChartScale {
  observedMin: number;
  observedMax: number;
  scaleMin: number;
  scaleMax: number;
}

/**
 * Calculates Levey-Jennings parameters treating the configured acceptable
 * operating limits [min, max] as the ±3 Standard Deviation control lines.
 *
 * - Media = (min + max) / 2
 * - DE = (max - min) / 6
 */
export function calculateLeveyJenningsParams(
  min: number | null | undefined,
  max: number | null | undefined
): LeveyJenningsParams | null {
  if (min == null || max == null || !Number.isFinite(min) || !Number.isFinite(max) || min >= max) {
    return null;
  }

  const mean = (min + max) / 2;
  const sd = (max - min) / 6;

  const lines: LeveyJenningsLine[] = [
    { label: "+3 DE", value: max },
    { label: "+2 DE", value: mean + 2 * sd },
    { label: "+1 DE", value: mean + sd },
    { label: "Media", value: mean },
    { label: "−1 DE", value: mean - sd },
    { label: "−2 DE", value: mean - 2 * sd },
    { label: "−3 DE", value: min },
  ];

  return { mean, sd, lines };
}

/**
 * Computes min and max display boundaries for the SVG chart,
 * adding proportional margin (padding) so data points and boundary lines
 * are not clipped against plot borders.
 */
export function calculateChartScale(
  observedTemperatures: number[],
  min?: number | null,
  max?: number | null
): ChartScale {
  const validObserved = observedTemperatures.filter(Number.isFinite);
  const extentValues = min != null && max != null && min < max
    ? [...validObserved, min, max]
    : validObserved;

  const observedMin = extentValues.length ? Math.min(...extentValues) : 0;
  const observedMax = extentValues.length ? Math.max(...extentValues) : 1;
  const chartPadding = Math.max((observedMax - observedMin) * 0.12, 0.2);

  return {
    observedMin,
    observedMax,
    scaleMin: observedMin - chartPadding,
    scaleMax: observedMax + chartPadding,
  };
}

/**
 * Converts a temperature value to an SVG Y-coordinate.
 * (In SVG, Y=0 is at the top, so higher temperatures correspond to smaller Y values).
 */
export function getYCoordinate(
  temperature: number,
  scaleMin: number,
  scaleMax: number,
  plotTop: number,
  plotBottom: number
): number {
  if (scaleMax <= scaleMin) return (plotTop + plotBottom) / 2;
  return plotBottom - ((temperature - scaleMin) / (scaleMax - scaleMin)) * (plotBottom - plotTop);
}

/**
 * Converts a reading index to an SVG X-coordinate.
 * If there is only 1 reading, it positions it in the center of the plot.
 */
export function getXCoordinate(
  index: number,
  totalReadings: number,
  plotLeft: number,
  plotRight: number
): number {
  if (totalReadings <= 1) {
    return (plotLeft + plotRight) / 2;
  }
  return plotLeft + (index * (plotRight - plotLeft)) / (totalReadings - 1);
}

/**
 * Determines the color for a temperature point:
 * - Red (#dc2626) if outside the acceptable range
 * - Blue (#2563eb) for PM shifts
 * - Teal (#0f766e) for AM shifts
 */
export function getReadingPointColor(
  isOutOfRange: boolean,
  readingType?: "am" | "pm" | string | null
): string {
  if (isOutOfRange) return "#dc2626";
  return readingType === "pm" ? "#2563eb" : "#0f766e";
}

/**
 * Verifies if a temperature falls outside the acceptable [min, max] range.
 */
export function isTemperatureOutOfRange(
  temperature: number,
  min?: number | null,
  max?: number | null
): boolean {
  if (min == null || max == null) return false;
  return temperature < min || temperature > max;
}


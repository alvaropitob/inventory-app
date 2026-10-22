import { describe, expect, it } from "vitest";
import { validateEnvironmentalReading } from "@/lib/validation/environmental-reading";

describe("environmental reading validation", () => {
  it("allows the first reading for a shift", () => {
    expect(validateEnvironmentalReading({ alreadyRegistered: false, isCorrection: false, notes: "" })).toBeNull();
  });

  it("rejects a duplicate reading without correction intent", () => {
    expect(validateEnvironmentalReading({ alreadyRegistered: true, isCorrection: false, notes: "" })).toContain("Ya existe una lectura");
  });

  it("requires a reason for a correction", () => {
    expect(validateEnvironmentalReading({ alreadyRegistered: true, isCorrection: true, notes: "  " })).toContain("motivo");
  });

  it("rejects a correction when there is no earlier reading", () => {
    expect(validateEnvironmentalReading({ alreadyRegistered: false, isCorrection: true, notes: "Error de digitación" })).toContain("No existe una lectura previa");
  });

  it("allows a correction with a reason", () => {
    expect(validateEnvironmentalReading({ alreadyRegistered: true, isCorrection: true, notes: "Se corrigió lectura del termómetro" })).toBeNull();
  });
});

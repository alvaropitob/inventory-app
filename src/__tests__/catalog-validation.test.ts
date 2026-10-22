import { describe, expect, it } from "vitest";
import { validateCatalogProduct } from "@/lib/validation/catalog";

const trackedFields = {
  internal_code: "QA-001",
  technical_name: "Producto QA",
  purchase_unit: "Unidad",
  commercial_presentation: "No aplica",
  brand: "No aplica",
  sanitary_registration: "No aplica",
  risk_classification: "not_applicable",
  shelf_life: "No aplica",
  series: "No aplica",
  product_description: "No aplica",
  supplier_id: "not_applicable",
};

describe("catalog product validation", () => {
  it.each(["dispositivo_medico", "reactivo", "insumo"] as const)(
    "accepts complete QA fields with No aplica for %s",
    productType => {
      expect(validateCatalogProduct({ ...trackedFields, product_type: productType })).toBeNull();
    },
  );

  it.each([
    "brand",
    "commercial_presentation",
    "sanitary_registration",
    "risk_classification",
    "shelf_life",
    "series",
    "product_description",
    "supplier_id",
  ])("requires %s for QA-tracked products", field => {
    const values: Record<string, string> = { ...trackedFields, product_type: "insumo" };
    values[field] = "";

    expect(validateCatalogProduct(values)).not.toBeNull();
  });

  it("rejects unsupported product types", () => {
    expect(validateCatalogProduct({ ...trackedFields, product_type: "other" })).toContain("tipo de producto");
  });

  it("validates medication-specific fields without requiring a supplier", () => {
    expect(validateCatalogProduct({
      product_type: "medicamento",
      internal_code: "MED-001",
      technical_name: "Medicamento QA",
      purchase_unit: "Caja",
      commercial_presentation: "No aplica",
      active_ingredient: "No aplica",
      dosage_form: "No aplica",
      concentration: "No aplica",
      sanitary_registration: "No aplica",
    })).toBeNull();
  });
});

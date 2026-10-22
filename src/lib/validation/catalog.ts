export const catalogProductTypes = ["medicamento", "dispositivo_medico", "reactivo", "insumo"] as const;

export type CatalogProductType = typeof catalogProductTypes[number];

const trackedProductTypes: CatalogProductType[] = ["dispositivo_medico", "reactivo", "insumo"];
const validRiskClassifications = ["I", "II", "IIA", "IIB", "III", "not_applicable"];

export function validateCatalogProduct(values: Record<string, string>): string | null {
  const productType = values.product_type as CatalogProductType;
  if (!catalogProductTypes.includes(productType)) return "Selecciona un tipo de producto válido.";

  const requiredFields = ["internal_code", "technical_name", "purchase_unit", "commercial_presentation"];
  if (productType === "medicamento") {
    requiredFields.push("active_ingredient", "dosage_form", "concentration", "sanitary_registration");
  }
  if (trackedProductTypes.includes(productType)) {
    requiredFields.push("brand", "sanitary_registration", "risk_classification", "shelf_life", "series", "product_description");
    if (!values.supplier_id) return "Selecciona un proveedor o marca el campo como No aplica.";
  }

  if (requiredFields.some(field => !values[field]?.trim())) {
    return "Completa los campos obligatorios del producto.";
  }
  if (values.risk_classification && !validRiskClassifications.includes(values.risk_classification)) {
    return "La clasificación de riesgo no es válida.";
  }
  return null;
}

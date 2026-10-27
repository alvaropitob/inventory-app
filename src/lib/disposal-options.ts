export const dispositionCauses = [
  { value: "expired", label: "Vencimiento" },
  { value: "damaged", label: "Daño o deterioro" },
  { value: "quality_alert", label: "Alerta de calidad / retiro" },
  { value: "temperature_excursion", label: "Desviación de temperatura" },
  { value: "contamination", label: "Contaminación" },
  { value: "other", label: "Otro" },
] as const;

export const disposalRoutes = [
  { value: "biohazard_waste", label: "Gestor de residuos biosanitarios" },
  { value: "supplier_return", label: "Devolución al proveedor" },
  { value: "post_consumer_program", label: "Programa posconsumo" },
  { value: "authorized_destruction", label: "Destrucción autorizada" },
  { value: "other", label: "Otro método" },
] as const;

export type DispositionCause = typeof dispositionCauses[number]["value"];
export type DisposalRoute = typeof disposalRoutes[number]["value"];

export function getDispositionCauseLabel(value?: string | null): string {
  return dispositionCauses.find(option => option.value === value)?.label || "Sin especificar";
}

export function getDisposalRouteLabel(value?: string | null): string {
  return disposalRoutes.find(option => option.value === value)?.label || "Sin especificar";
}

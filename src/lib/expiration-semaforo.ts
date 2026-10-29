import { getDaysUntilDateKey } from "@/lib/dates";

export type ExpirationSemaforoState = "expired" | "near_expiry" | "valid";

export interface ExpirationSemaforo {
  daysRemaining: number;
  state: ExpirationSemaforoState;
  label: string;
  color: string;
  isExpired: boolean;
}

/**
 * Semaforización institucional de vencimientos, calculada por día en Bogotá:
 * vencido = negro; de 1 a 30 días = rojo; más de 30 días = verde.
 */
export function getExpirationSemaforo(
  expirationDate: string,
  batchStatus?: string | null,
  clinicalStatus?: string | null,
  today: Date = new Date(),
): ExpirationSemaforo {
  const daysRemaining = getDaysUntilDateKey(expirationDate.slice(0, 10), today);

  if (batchStatus === "expired" || clinicalStatus === "expired" || daysRemaining <= 0) {
    return {
      daysRemaining,
      state: "expired",
      label: "Vencido",
      color: "#000000",
      isExpired: true,
    };
  }

  if (daysRemaining <= 30) {
    return {
      daysRemaining,
      state: "near_expiry",
      label: "Próximo a vencer",
      color: "#dc2626",
      isExpired: false,
    };
  }

  return {
    daysRemaining,
    state: "valid",
    label: "Vigente",
    color: "#10b981",
    isExpired: false,
  };
}

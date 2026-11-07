export const PQR_TYPES = [
  { value: "anomalia", label: "Anomalía del programa", hint: "Algo no funciona como debería (error, dato incorrecto, pantalla que falla)." },
  { value: "peticion", label: "Petición", hint: "Solicitud de apoyo, acceso, datos o un cambio puntual." },
  { value: "queja", label: "Queja", hint: "Inconformidad con el funcionamiento o el servicio recibido." },
  { value: "reclamo", label: "Reclamo", hint: "Un compromiso o corrección pendiente que no se ha cumplido." },
  { value: "sugerencia", label: "Sugerencia", hint: "Idea de mejora para el programa." },
] as const;

export const PQR_PRIORITIES = [
  { value: "low", label: "Baja", pill: "pill-slate" },
  { value: "medium", label: "Media", pill: "pill-blue" },
  { value: "high", label: "Alta", pill: "pill-amber" },
  { value: "critical", label: "Crítica", pill: "pill-red" },
] as const;

export const PQR_STATUSES = [
  { value: "open", label: "Abierta", pill: "pill-blue" },
  { value: "in_review", label: "En revisión", pill: "pill-amber" },
  { value: "in_progress", label: "En trabajo", pill: "pill-amber" },
  { value: "waiting_user", label: "Esperando al usuario", pill: "pill-slate" },
  { value: "resolved", label: "Resuelta", pill: "pill-green" },
  { value: "rejected", label: "Rechazada", pill: "pill-red" },
  { value: "closed", label: "Cerrada", pill: "pill-slate" },
] as const;

export const PQR_MODULES = [
  "Panel", "Inventario", "Pedidos", "Recepción técnica", "Proveedores", "Gestión de alertas",
  "Monitoreo ambiental", "Equipos", "Reportes", "Auditoría", "Usuarios", "Roles y permisos",
  "Configuración", "Inicio de sesión", "Otro",
] as const;

export const PQR_OPEN_STATUSES = ["open", "in_review", "in_progress", "waiting_user"] as const;
export const PQR_DONE_STATUSES = ["resolved", "rejected", "closed"] as const;

export interface PqrTicket {
  id: string;
  ticket_number: number;
  ticket_type: string;
  module: string;
  title: string;
  description: string;
  context_url: string | null;
  priority: string;
  status: string;
  reporter_id: string;
  reporter_name: string;
  assigned_to: string | null;
  assigned_name: string | null;
  resolution: string | null;
  reopen_count: number;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  closed_at: string | null;
}

export interface PqrEvent {
  id: string;
  ticket_id: string;
  actor_id: string;
  actor_name: string;
  event_type: "created" | "comment" | "status_change" | "assignment" | "priority_change" | "reopened";
  from_value: string | null;
  to_value: string | null;
  comment: string | null;
  is_internal: boolean;
  created_at: string;
}

export const PQR_TICKET_COLUMNS =
  "id, ticket_number, ticket_type, module, title, description, context_url, priority, status, reporter_id, reporter_name, assigned_to, assigned_name, resolution, reopen_count, created_at, updated_at, resolved_at, closed_at";

export function pqrCode(ticketNumber: number): string {
  return `PQR-${String(ticketNumber).padStart(5, "0")}`;
}

export function pqrTypeLabel(value: string): string {
  return PQR_TYPES.find((item) => item.value === value)?.label ?? value;
}

export function pqrStatus(value: string) {
  return PQR_STATUSES.find((item) => item.value === value) ?? { value, label: value, pill: "pill-slate" };
}

export function pqrPriority(value: string) {
  return PQR_PRIORITIES.find((item) => item.value === value) ?? { value, label: value, pill: "pill-slate" };
}

export function isPqrOpen(status: string): boolean {
  return (PQR_OPEN_STATUSES as readonly string[]).includes(status);
}

export function formatPqrDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-CO", {
    timeZone: "America/Bogota", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

/** Human readable elapsed time, e.g. "2 d 4 h" or "35 min". */
export function formatPqrDuration(fromIso: string, toIso: string | null): string {
  const end = toIso ? new Date(toIso).getTime() : Date.now();
  const minutes = Math.max(0, Math.round((end - new Date(fromIso).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ${minutes % 60} min`;
  const days = Math.floor(hours / 24);
  return `${days} d ${hours % 24} h`;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}


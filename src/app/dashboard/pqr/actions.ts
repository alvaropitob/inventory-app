"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/supabase/authorization";
import { isUuid, PQR_PRIORITIES, PQR_STATUSES, PQR_TYPES } from "@/lib/pqr";

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function back(path: string, kind: "error" | "success", message: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(message)}`);
}

function refresh(ticketId?: string) {
  revalidatePath("/dashboard/pqr");
  if (ticketId) revalidatePath(`/dashboard/pqr/${ticketId}`);
}

export async function createPqr(formData: FormData) {
  const { supabase } = await requirePermission("pqr.submit");
  const type = text(formData, "ticket_type");
  const priority = text(formData, "priority");
  const title = text(formData, "title");
  const description = text(formData, "description");
  const moduleName = text(formData, "module");
  const contextUrl = text(formData, "context_url");

  if (!PQR_TYPES.some((item) => item.value === type)) back("/dashboard/pqr/nuevo", "error", "Selecciona el tipo de solicitud.");
  if (!PQR_PRIORITIES.some((item) => item.value === priority)) back("/dashboard/pqr/nuevo", "error", "Selecciona la prioridad.");
  if (title.length < 5 || title.length > 160) back("/dashboard/pqr/nuevo", "error", "El asunto debe tener entre 5 y 160 caracteres.");
  if (description.length < 10 || description.length > 4000) back("/dashboard/pqr/nuevo", "error", "La descripción debe tener entre 10 y 4000 caracteres.");

  const { data, error } = await supabase.rpc("fn_pqr_create", {
    p_type: type, p_module: moduleName || "Otro", p_title: title, p_description: description,
    p_priority: priority, p_context_url: contextUrl || null,
  });
  if (error || !isUuid(data)) back("/dashboard/pqr/nuevo", "error", error?.message ?? "No se pudo registrar la solicitud.");

  refresh();
  redirect(`/dashboard/pqr/${data}?success=${encodeURIComponent("Solicitud registrada. Puedes seguir su avance desde esta página.")}`);
}

export async function addPqrComment(formData: FormData) {
  const { supabase } = await requirePermission("pqr.submit");
  const ticketId = text(formData, "ticket_id");
  if (!isUuid(ticketId)) redirect("/dashboard/pqr");
  const path = `/dashboard/pqr/${ticketId}`;
  const comment = text(formData, "comment");
  if (comment.length < 2) back(path, "error", "Escribe un comentario.");

  const { error } = await supabase.rpc("fn_pqr_add_comment", {
    p_ticket_id: ticketId, p_comment: comment, p_is_internal: formData.get("is_internal") === "on",
  });
  if (error) back(path, "error", error.message);
  refresh(ticketId);
  back(path, "success", "Comentario registrado.");
}

export async function reopenPqr(formData: FormData) {
  const { supabase } = await requirePermission("pqr.submit");
  const ticketId = text(formData, "ticket_id");
  if (!isUuid(ticketId)) redirect("/dashboard/pqr");
  const path = `/dashboard/pqr/${ticketId}`;
  const reason = text(formData, "reason");
  if (reason.length < 10) back(path, "error", "Explica por qué la solución no fue suficiente (mínimo 10 caracteres).");

  const { error } = await supabase.rpc("fn_pqr_reopen", { p_ticket_id: ticketId, p_reason: reason });
  if (error) back(path, "error", error.message);
  refresh(ticketId);
  back(path, "success", "Solicitud reabierta.");
}

export async function managePqr(formData: FormData) {
  const { supabase } = await requirePermission("pqr.manage");
  const ticketId = text(formData, "ticket_id");
  if (!isUuid(ticketId)) redirect("/dashboard/pqr");
  const path = `/dashboard/pqr/${ticketId}`;
  const status = text(formData, "status");
  const priority = text(formData, "priority");
  const assignedTo = text(formData, "assigned_to");
  if (!PQR_STATUSES.some((item) => item.value === status)) back(path, "error", "Estado no válido.");
  if (!PQR_PRIORITIES.some((item) => item.value === priority)) back(path, "error", "Prioridad no válida.");
  if (assignedTo && !isUuid(assignedTo)) back(path, "error", "Responsable no válido.");

  const { error } = await supabase.rpc("fn_pqr_manage", {
    p_ticket_id: ticketId, p_status: status, p_priority: priority, p_assigned_to: assignedTo || null,
    p_resolution: text(formData, "resolution") || null, p_comment: text(formData, "comment") || null,
  });
  if (error) back(path, "error", error.message);
  refresh(ticketId);
  back(path, "success", "Solicitud actualizada.");
}


"use server";

import { EquipmentService, Equipment, MaintenanceRecord } from "@/lib/services/equipment";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/supabase/authorization";
import { isValidDateKey } from "@/lib/dates";

export async function handleEquipmentAction(formData: FormData) {
  await requireRole(["admin", "supervisor"]);
  const id = formData.get("id") as string;
  const invimaExpirationDate = String(formData.get("invima_expiration_date") || "");
  if (invimaExpirationDate && !isValidDateKey(invimaExpirationDate)) {
    throw new Error("La fecha de vencimiento INVIMA no es válida.");
  }
  
  const data: Partial<Equipment> = {
    id: id || undefined,
    name: formData.get("name") as string,
    brand: formData.get("brand") as string,
    model: formData.get("model") as string,
    serial_number: formData.get("serial_number") as string,
    inventory_number: formData.get("inventory_number") as string,
    section_id: formData.get("section_id") as string,
    measurement_range: formData.get("measurement_range") as string,
    sanitary_registration: formData.get("sanitary_registration") as string,
    invima_expiration_date: invimaExpirationDate || undefined,
    risk_classification: formData.get("risk_classification") as string,
    calibration_frequency: formData.get("calibration_frequency") as string,
    maintenance_frequency: formData.get("maintenance_frequency") as string,
    responsible: formData.get("responsible") as string,
    location_id: formData.get("location_id") as string,
    status: (formData.get("status") as Equipment['status']) || 'active',
  };

  try {
    await EquipmentService.upsertEquipment(data);
    revalidatePath("/dashboard/equipos");
  } catch (error) {
    console.error("Error upserting equipment:", error);
    throw error;
  }
}

export async function handleMaintenanceAction(formData: FormData) {
  const { user } = await requireRole(["admin", "supervisor", "operator"]);
  const equipmentId = formData.get("equipment_id") as string;
  const executionDate = String(formData.get("execution_date") || "");
  const scheduledDate = String(formData.get("scheduled_date") || "");
  const nextDueDate = String(formData.get("next_due_date") || "");
  if (!equipmentId || !isValidDateKey(executionDate) || !isValidDateKey(scheduledDate) || (nextDueDate && !isValidDateKey(nextDueDate))) {
    throw new Error("Registra una fecha programada y una fecha de realización válidas.");
  }
  
  const data: Partial<MaintenanceRecord> = {
    equipment_id: equipmentId,
    type: formData.get("type") as MaintenanceRecord['type'],
    execution_date: executionDate,
    scheduled_date: scheduledDate,
    performed_by: user.id,
    provider_name: formData.get("provider_name") as string,
    description: formData.get("description") as string,
    result: formData.get("result") as string,
    next_due_date: nextDueDate || undefined,
  };

  try {
    await EquipmentService.addMaintenanceRecord(data);
    revalidatePath("/dashboard/equipos");
    revalidatePath(`/dashboard/equipos/${equipmentId}`);
  } catch (error) {
    console.error("Error adding maintenance record:", error);
    throw error;
  }
}

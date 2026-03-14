"use server";

import { EquipmentService, Equipment, MaintenanceRecord } from "@/lib/services/equipment";
import { revalidatePath } from "next/cache";

export async function handleEquipmentAction(formData: FormData) {
  const id = formData.get("id") as string;
  
  const data: Partial<Equipment> = {
    id: id || undefined,
    name: formData.get("name") as string,
    brand: formData.get("brand") as string,
    model: formData.get("model") as string,
    serial_number: formData.get("serial_number") as string,
    location_id: formData.get("location_id") as string,
    status: formData.get("status") as any || 'active',
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
  const equipmentId = formData.get("equipment_id") as string;
  
  const data: Partial<MaintenanceRecord> = {
    equipment_id: equipmentId,
    type: formData.get("type") as any,
    execution_date: formData.get("execution_date") as string,
    performed_by: formData.get("performed_by") as string,
    description: formData.get("description") as string,
    result: formData.get("result") as string,
    next_due_date: formData.get("next_due_date") as string,
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

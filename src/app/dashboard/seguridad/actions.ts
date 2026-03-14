"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ComplianceServiceV2, IncidentType } from "@/lib/services/compliance_v2";

export async function submitSafetyIncident(formData: FormData) {
    const batch_id = formData.get("batch_id") as string;
    const incident_type = formData.get("incident_type") as IncidentType;
    const description = formData.get("description") as string;
    const action_taken = formData.get("action_taken") as string;

    if (!batch_id || !incident_type || !description) {
        throw new Error("Datos obligatorios faltantes");
    }

    try {
        await ComplianceServiceV2.reportSafetyIncident({
            batch_id,
            incident_type,
            description,
            action_taken
        });
        
        revalidatePath("/dashboard/seguridad");
        revalidatePath("/dashboard/inventario");
        revalidatePath("/dashboard");
    } catch (error: any) {
        console.error("Error submitting safety incident:", error);
        throw error;
    }

    redirect("/dashboard/seguridad");
}

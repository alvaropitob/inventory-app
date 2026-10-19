"use server";

import { revalidatePath } from "next/cache";
import { ComplianceService } from "@/lib/services/compliance";
import { requireRole } from "@/lib/supabase/authorization";

export async function submitEnvironmentalLog(formData: FormData) {
    await requireRole(["admin", "operator"]);
    const location_id = formData.get("location_id") as string;
    const temperature = parseFloat(formData.get("temperature") as string);
    const humidity = formData.get("humidity") ? parseFloat(formData.get("humidity") as string) : undefined;
    const notes = formData.get("notes") as string;

    if (!location_id || isNaN(temperature)) {
        throw new Error("Datos obligatorios faltantes");
    }

    try {
        await ComplianceService.recordEnvironmentalLog({
            location_id,
            temperature,
            humidity,
            notes
        });
        revalidatePath("/dashboard/monitoreo");
    } catch (error: unknown) {
        console.error("Error submitting environmental log:", error);
        throw error;
    }
}

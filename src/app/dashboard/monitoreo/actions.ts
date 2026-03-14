"use server";

import { revalidatePath } from "next/cache";
import { ComplianceServiceV2 } from "@/lib/services/compliance_v2";

export async function submitEnvironmentalLog(formData: FormData) {
    const location_id = formData.get("location_id") as string;
    const temperature = parseFloat(formData.get("temperature") as string);
    const humidity = formData.get("humidity") ? parseFloat(formData.get("humidity") as string) : undefined;
    const notes = formData.get("notes") as string;

    if (!location_id || isNaN(temperature)) {
        throw new Error("Datos obligatorios faltantes");
    }

    try {
        await ComplianceServiceV2.recordEnvironmentalLog({
            location_id,
            temperature,
            humidity,
            notes
        });
        revalidatePath("/dashboard/monitoreo");
    } catch (error: any) {
        console.error("Error submitting environmental log:", error);
    }
}

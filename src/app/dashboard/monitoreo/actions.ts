"use server";

import { revalidatePath } from "next/cache";
import { ComplianceService } from "@/lib/services/compliance";
import { requireRole } from "@/lib/supabase/authorization";
import { validateEnvironmentalReading } from "@/lib/validation/environmental-reading";
import { getDateKeyInBusinessTimeZone } from "@/lib/dates";

export async function submitEnvironmentalLog(formData: FormData) {
    await requireRole(["admin", "operator"]);
    const location_id = formData.get("location_id") as string;
    const rawTemperature = String(formData.get("temperature") || "").trim();
    const temperature = rawTemperature ? Number(rawTemperature) : Number.NaN;
    const rawHumidity = String(formData.get("humidity") || "").trim();
    const humidity = rawHumidity ? Number(rawHumidity) : undefined;
    const notes = String(formData.get("notes") || "").trim();
    const readingType = formData.get("reading_type") === "pm" ? "pm" : "am";
    const isCorrection = formData.get("is_correction") === "on";

    if (!location_id || !Number.isFinite(temperature) || (humidity !== undefined && !Number.isFinite(humidity))) {
        throw new Error("Datos obligatorios faltantes");
    }

    try {
        const readingDate = getDateKeyInBusinessTimeZone(new Date());
        const alreadyRegistered = await ComplianceService.hasEnvironmentalReadingForShift(location_id, readingDate, readingType);
        const validationError = validateEnvironmentalReading({ alreadyRegistered, isCorrection, notes });
        if (validationError) throw new Error(validationError);

        await ComplianceService.recordEnvironmentalLog({
            location_id,
            temperature,
            humidity,
            notes: notes || undefined,
            reading_type: readingType,
            is_correction: isCorrection,
        });
        revalidatePath("/dashboard/monitoreo");
    } catch (error: unknown) {
        console.error("Error submitting environmental log:", error);
        throw error;
    }
}

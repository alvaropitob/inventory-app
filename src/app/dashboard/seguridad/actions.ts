"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ComplianceService, IncidentType } from "@/lib/services/compliance";
import { requireRole } from "@/lib/supabase/authorization";

export async function submitSafetyIncident(formData: FormData) {
    await requireRole(["admin", "operator", "supervisor"]);
    const batch_id = formData.get("batch_id") as string;
    const incident_type = formData.get("incident_type") as IncidentType;
    const description = formData.get("description") as string;
    const action_taken = formData.get("action_taken") as string;

    if (!batch_id || !incident_type || !description) {
        throw new Error("Datos obligatorios faltantes");
    }

    try {
        await ComplianceService.reportSafetyIncident({
            batch_id,
            incident_type,
            description,
            action_taken
        });
        
        revalidatePath("/dashboard/seguridad");
        revalidatePath("/dashboard/inventario");
        revalidatePath("/dashboard");
    } catch (error: unknown) {
        console.error("Error submitting safety incident:", error);
        throw error;
    }

    redirect("/dashboard/seguridad");
}

export async function saveMonthlyAlertReport(formData: FormData) {
    await requireRole(["admin", "supervisor"]);
    const monthValue = String(formData.get("period_month") || "");
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthValue)) throw new Error("Selecciona un mes válido.");

    const fields = [
        "verified_device_reagent_alerts",
        "verified_device_reagent_security_reports",
        "verified_medicine_biological_reports",
        "managed_reactivovigilance",
        "managed_tecnovigilance",
        "managed_pharmacovigilance",
    ] as const;
    const counts = Object.fromEntries(fields.map(field => {
        const value = Number(formData.get(field));
        if (!Number.isSafeInteger(value) || value < 0) throw new Error("Los conteos deben ser enteros iguales o mayores que cero.");
        return [field, value];
    })) as Record<typeof fields[number], number>;
    const vigilance_percentage = Number(formData.get("vigilance_percentage"));
    if (!Number.isFinite(vigilance_percentage) || vigilance_percentage < 0 || vigilance_percentage > 100) {
        throw new Error("El porcentaje de vigilancia debe estar entre 0 y 100.");
    }

    await ComplianceService.saveMonthlyAlertReport({
        period_month: `${monthValue}-01`,
        ...counts,
        vigilance_percentage,
        notes: String(formData.get("notes") || "").trim() || undefined,
    });
    revalidatePath("/dashboard/seguridad");
}

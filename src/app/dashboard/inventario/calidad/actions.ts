"use server";

import { revalidatePath } from "next/cache";
import { ComplianceService } from "@/lib/services/compliance";

export async function submitQualityVerification(formData: FormData) {
    const batch_id = formData.get("batch_id") as string;
    const result = formData.get("result") as 'pass' | 'fail';
    const control_lot = formData.get("control_lot") as string;
    const observations = formData.get("observations") as string;
    const verification_seal = formData.get("verification_seal") as string;

    if (!batch_id || !result) {
        throw new Error("Datos obligatorios faltantes");
    }

    try {
        await ComplianceService.verifyBatchQuality({
            batch_id,
            result,
            control_lot,
            observations,
            verification_seal
        });
        
        revalidatePath("/dashboard/inventario/calidad");
        revalidatePath("/dashboard/inventario");
        revalidatePath("/dashboard");
    } catch (error: unknown) {
        console.error("Error submitting quality verification:", error);
    }
}

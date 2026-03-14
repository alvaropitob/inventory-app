"use server";

import { revalidatePath } from "next/cache";
import { ComplianceServiceV3 } from "@/lib/services/compliance_v3";

export async function submitQualityVerification(formData: FormData) {
    const batch_id = formData.get("batch_id") as string;
    const result = formData.get("result") as 'pass' | 'fail';
    const control_lot = formData.get("control_lot") as string;
    const observations = formData.get("observations") as string;

    if (!batch_id || !result) {
        throw new Error("Datos obligatorios faltantes");
    }

    try {
        await ComplianceServiceV3.verifyBatchQuality({
            batch_id,
            result,
            control_lot,
            observations
        });
        
        revalidatePath("/dashboard/inventario/calidad");
        revalidatePath("/dashboard/inventario");
        revalidatePath("/dashboard");
    } catch (error: any) {
        console.error("Error submitting quality verification:", error);
    }
}

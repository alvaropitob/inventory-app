"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ComplianceServiceV3 } from "@/lib/services/compliance_v3";

export async function submitSupplierEvaluation(formData: FormData) {
    const supplier_id = formData.get("supplier_id") as string;
    const criteria_quality = parseInt(formData.get("criteria_quality") as string);
    const criteria_delivery_time = parseInt(formData.get("criteria_delivery_time") as string);
    const criteria_support = parseInt(formData.get("criteria_support") as string);
    const comments = formData.get("comments") as string;

    if (!supplier_id || isNaN(criteria_quality) || isNaN(criteria_delivery_time) || isNaN(criteria_support)) {
        throw new Error("Datos obligatorios faltantes o inválidos");
    }

    try {
        await ComplianceServiceV3.evaluateSupplier({
            supplier_id,
            criteria_quality,
            criteria_delivery_time,
            criteria_support,
            comments
        });
        
        revalidatePath("/dashboard/proveedores/evaluacion");
        revalidatePath("/dashboard/reportes");
    } catch (error: unknown) {
        console.error("Error submitting supplier evaluation:", error);
        throw error;
    }

    redirect("/dashboard/proveedores/evaluacion");
}

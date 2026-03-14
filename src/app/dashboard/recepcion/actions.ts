"use server";

import { ComplianceService } from "@/lib/services/compliance";
import { revalidatePath } from "next/cache";

export async function submitTechnicalReception(data: {
    order_id: string;
    packaging_status: string;
    integrity_verified: boolean;
    reception_temperature: number;
    is_approved: boolean;
    notes?: string;
    items: {
        catalog_item_id: string;
        lot_number: string;
        expiration_date: string;
        quantity_received: number;
        unit_price: number;
    }[];
}) {
    try {
        const result = await ComplianceService.createTechnicalReception(data);
        
        // Revalidar las rutas afectadas para que los cambios se vean de inmediato
        revalidatePath("/dashboard/recepcion");
        revalidatePath("/dashboard/inventario");
        
        return result;
    } catch (error) {
        console.error("Error in submitTechnicalReception:", error);
        throw new Error(error instanceof Error ? error.message : "Error desconocido al procesar la recepción");
    }
}

"use server";

import { ComplianceService } from "@/lib/services/compliance";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/supabase/authorization";

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
    await requireRole(["admin", "operator"]);
    if (!data.order_id || !Array.isArray(data.items) || data.items.length === 0 || data.items.length > 500 ||
        !Number.isFinite(data.reception_temperature) || data.items.some(item =>
          !item.catalog_item_id || !item.lot_number?.trim() || !Number.isSafeInteger(item.quantity_received) || item.quantity_received <= 0 ||
          !Number.isFinite(item.unit_price) || item.unit_price < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(item.expiration_date))) {
        throw new Error("Datos de recepción inválidos");
    }
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

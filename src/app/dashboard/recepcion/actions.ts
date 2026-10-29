"use server";

import { ComplianceService } from "@/lib/services/compliance";
import { CatalogService } from "@/lib/services/catalog";
import { OrderService } from "@/lib/services/orders";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/supabase/authorization";

export async function submitTechnicalReception(data: {
    order_id: string;
    invoice_number: string;
    packaging_status: string;
    integrity_verified: boolean;
    reception_temperature: number;
    is_approved: boolean;
    notes?: string;
    items: {
        catalog_item_id: string;
        section_id: string;
        lot_number: string;
        sanitary_registration?: string;
        expiration_date: string;
        quantity_received: number;
        location_id: string;
        unit_price: number;
    }[];
}) {
    await requireRole(["admin", "operator"]);
    if (!data.order_id || !Array.isArray(data.items) || data.items.length === 0 || data.items.length > 500 ||
        !Number.isFinite(data.reception_temperature) || !data.invoice_number?.trim() || data.items.some(item =>
          !item.catalog_item_id || !item.lot_number?.trim() || (item.sanitary_registration?.length ?? 0) > 200 || !Number.isSafeInteger(item.quantity_received) || item.quantity_received <= 0 ||
          !item.section_id || !item.location_id ||
          !Number.isFinite(item.unit_price) || item.unit_price < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(item.expiration_date))) {
        throw new Error("Datos de recepción inválidos");
    }
    if (new Set(data.items.map(item => item.catalog_item_id)).size !== data.items.length) {
        throw new Error("Cada producto de la orden solo puede aparecer una vez por recepción.");
    }
    const [order, { data: locations, error: locationsError }, { data: sections, error: sectionsError }] = await Promise.all([
        OrderService.getOrderById(data.order_id),
        CatalogService.getLocations(),
        CatalogService.getSections(),
    ]);
    if (locationsError || sectionsError) throw new Error("No se pudieron validar las áreas y ubicaciones activas.");
    for (const receivedItem of data.items) {
        const orderedItem = order.items?.find(item => item.item_id === receivedItem.catalog_item_id);
        const location = locations?.find(candidate => candidate.id === receivedItem.location_id && candidate.is_active);
        const activeSection = sections?.find(section => section.id === receivedItem.section_id && section.is_active);
        if (!orderedItem || !location || !activeSection || location.section_id !== activeSection.id || location.sections?.is_active !== true) {
            throw new Error("La ubicación debe estar asociada al área activa del producto.");
        }
    }
    try {
        const result = await ComplianceService.createTechnicalReception(data);
        
        // Revalidar las rutas afectadas para que los cambios se vean de inmediato
        revalidatePath("/dashboard/recepcion");
        revalidatePath("/dashboard/inventario");
        revalidatePath("/dashboard/configuracion");
        
        return result;
    } catch (error) {
        console.error("Error in submitTechnicalReception:", error);
        throw new Error(error instanceof Error ? error.message : "Error desconocido al procesar la recepción");
    }
}

import { createClient } from "@/lib/supabase/server";

export type LotStatus = 'accepted' | 'quarantine' | 'rejected' | 'expired';

export interface InventoryLot {
    id: string;
    catalog_item_id: string;
    lot_number: string;
    expiration_date: string;
    current_quantity: number;
    clinical_status: LotStatus;
    storage_location_id?: string;
    manufacturer_name?: string;
    created_at?: string;
}

export const ComplianceService = {
    /**
     * Obtiene el lote sugerido para usar (Lógica FEFO)
     */
    async getSuggestedLot(itemId: string) {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from('inventory_batches')
            .select('*')
            .eq('item_id', itemId)
            .eq('clinical_status', 'accepted')
            .gt('current_stock', 0)
            .gt('expiration_date', new Date().toISOString().split('T')[0])
            .order('expiration_date', { ascending: true })
            .limit(1)
            .single();

        if (error) return null;
        return data;
    },

    /**
     * Obtiene todos los lotes de un ítem específico
     */
    async getItemLots(itemId: string) {
        const supabase = await createClient();
        return await supabase
            .from('inventory_batches')
            .select('*, locations(name)')
            .eq('item_id', itemId)
            .order('expiration_date', { ascending: true });
    },

    /**
     * Registra una recepción técnica formal
     */
    async createTechnicalReception(data: {
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
        const supabase = await createClient();

        // 1. Crear el encabezado de recepción
        const { data: reception, error: receptionError } = await supabase
            .from('technical_receptions')
            .insert({
                order_id: data.order_id,
                packaging_status: data.packaging_status,
                integrity_verified: data.integrity_verified,
                reception_temperature: data.reception_temperature,
                is_approved: data.is_approved,
                notes: data.notes
            })
            .select()
            .single();

        if (receptionError) throw receptionError;

        // 2. Procesar cada ítem: Crear lote (batch) y asociar a la recepción
        for (const item of data.items) {
            // Crear el batch en inventory_batches
            const { data: batch, error: batchError } = await supabase
                .from('inventory_batches')
                .insert({
                    item_id: item.catalog_item_id,
                    batch_number: item.lot_number,
                    expiration_date: item.expiration_date,
                    current_stock: item.quantity_received,
                    initial_quantity: item.quantity_received,
                    clinical_status: data.is_approved ? 'accepted' : 'quarantine'
                })
                .select()
                .single();

            if (batchError) throw batchError;

            // Asociar el ítem a la recepción
            const { error: itemError } = await supabase
                .from('reception_items')
                .insert({
                    technical_reception_id: reception.id,
                    catalog_item_id: item.catalog_item_id,
                    batch_id: batch.id,
                    quantity_received: item.quantity_received,
                    unit_price: item.unit_price
                });

            if (itemError) throw itemError;
        }

        return { success: true, receptionId: reception.id };
    }
};

import { createClient } from "@/lib/supabase/server";
import { AuditService } from "./audit";

export type LotStatus = 'accepted' | 'quarantine' | 'rejected' | 'expired';
export type IncidentType = 'recall' | 'adverse_event' | 'quality_failure' | 'other';

export interface InventoryLot {
    id: string;
    catalog_item_id: string;
    lot_number: string;
    expiration_date: string;
    current_stock: number;
    clinical_status: LotStatus;
    storage_location_id?: string;
    manufacturer_name?: string;
    created_at?: string;
}

export interface EnvironmentalLog {
    id: string;
    location_id: string;
    temperature: number;
    humidity?: number;
    created_at: string;
    user_id: string;
    notes?: string;
    locations?: { name: string };
}

export interface SafetyIncident {
    id: string;
    batch_id: string;
    incident_type: IncidentType;
    description: string;
    reported_at: string;
    reported_by: string;
    action_taken?: string;
    batch?: {
        batch_number: string;
        item?: { technical_name: string };
    };
}

export interface QualityVerification {
    id: string;
    batch_id: string;
    verification_date: string;
    verified_by: string;
    result: 'pass' | 'fail';
    control_lot?: string;
    observations?: string;
    batch?: {
        batch_number: string;
        item?: { technical_name: string };
    };
}

export interface SupplierEvaluation {
    id: string;
    supplier_id: string;
    evaluation_date: string;
    evaluated_by: string;
    criteria_quality: number;
    criteria_delivery_time: number;
    criteria_support: number;
    total_score: number;
    comments?: string;
    supplier?: { name: string };
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

        if (error || !data) {
            console.warn("No suggested lot found for item:", itemId);
            return null;
        }
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

        // 3. Actualizar el estado del pedido a 'completed'
        const { error: orderUpdateError } = await supabase
            .from('purchase_orders')
            .update({ status: 'completed' })
            .eq('id', data.order_id);

        if (orderUpdateError) throw orderUpdateError;

        return { success: true, receptionId: reception.id };
    },

    /**
     * ENVIRONMENTAL LOGS (from V2)
     */
    async recordEnvironmentalLog(data: {
        location_id: string;
        temperature: number;
        humidity?: number;
        notes?: string;
    }) {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) throw new Error("Usuario no autenticado");

        const { data: log, error } = await supabase
            .from('environmental_readings')
            .insert({
                location_id: data.location_id,
                temperature: data.temperature,
                humidity: data.humidity,
                notes: data.notes,
                user_id: user.id
            })
            .select()
            .single();

        if (error) throw error;
        return log;
    },

    async getEnvironmentalLogs(limit = 50) {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from('environmental_readings')
            .select('*, locations(name)')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data as EnvironmentalLog[];
    },

    /**
     * SAFETY INCIDENTS (from V2)
     */
    async reportSafetyIncident(data: {
        batch_id: string;
        incident_type: IncidentType;
        description: string;
        action_taken?: string;
    }) {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) throw new Error("Usuario no autenticado");

        const { data: incident, error: incidentError } = await supabase
            .from('safety_incidents')
            .insert({
                batch_id: data.batch_id,
                incident_type: data.incident_type,
                description: data.description,
                action_taken: data.action_taken,
                reported_by: user.id
            })
            .select()
            .single();

        if (incidentError) throw incidentError;

        // Audit Log
        const id = incident.id; // Corrected ID access
        await AuditService.logAction({
            table_name: 'safety_incidents',
            record_id: id,
            action: 'INSERT',
            new_data: data,
            user_id: user.id,
            notes: `Incidente reportado: ${data.incident_type}`
        });

        if (data.incident_type === 'recall' || data.incident_type === 'quality_failure') {
            const { error: batchUpdateError } = await supabase
                .from('inventory_batches')
                .update({ clinical_status: 'rejected' })
                .eq('id', data.batch_id);

            if (batchUpdateError) throw batchUpdateError;
        }

        return incident;
    },

    async getSafetyIncidents() {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from('safety_incidents')
            .select(`
                *,
                batch:inventory_batches (
                    batch_number,
                    item:catalog_items (technical_name)
                )
            `)
            .order('reported_at', { ascending: false });

        if (error) throw error;
        return data as SafetyIncident[];
    },

    /**
     * QUALITY VERIFICATIONS (from V3)
     */
    async verifyBatchQuality(data: {
        batch_id: string;
        result: 'pass' | 'fail';
        control_lot?: string;
        observations?: string;
        verification_seal?: string;
    }) {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) throw new Error("Usuario no autenticado");

        const { data: verification, error } = await supabase
            .from('quality_verifications')
            .insert({
                batch_id: data.batch_id,
                result: data.result,
                control_lot: data.control_lot,
                observations: data.observations,
                verified_by: user.id,
                verification_seal: data.verification_seal || 'signed_digital_v1'
            })
            .select()
            .single();

        if (error) throw error;

        // Audit Log
        await AuditService.logAction({
            table_name: 'quality_verifications',
            record_id: verification.id,
            action: 'INSERT',
            new_data: data,
            notes: `Verificación de calidad: ${data.result}. Sello: ${data.verification_seal ? 'SI' : 'NO'}`
        });

        return verification;
    },

    async getPendingVerifications() {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from('inventory_batches')
            .select(`
                *,
                item:catalog_items (technical_name, commercial_name, internal_code),
                location:locations (name)
            `)
            .eq('clinical_status', 'quarantine')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    },

    /**
     * SUPPLIER EVALUATIONS (from V3)
     */
    async evaluateSupplier(data: {
        supplier_id: string;
        criteria_quality: number;
        criteria_delivery_time: number;
        criteria_support: number;
        comments?: string;
    }) {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) throw new Error("Usuario no autenticado");

        const total_score = (data.criteria_quality + data.criteria_delivery_time + data.criteria_support) / 3;

        const { data: evaluation, error } = await supabase
            .from('supplier_evaluations')
            .insert({
                supplier_id: data.supplier_id,
                criteria_quality: data.criteria_quality,
                criteria_delivery_time: data.criteria_delivery_time,
                criteria_support: data.criteria_support,
                total_score,
                comments: data.comments,
                evaluated_by: user.id
            })
            .select()
            .single();

        if (error) throw error;
        return evaluation;
    },

    async getSupplierEvaluations() {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from('supplier_evaluations')
            .select('*, supplier:suppliers(name)')
            .order('evaluation_date', { ascending: false });

        if (error) throw error;
        return data as SupplierEvaluation[];
    }
};

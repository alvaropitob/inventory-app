import { createClient } from "@/lib/supabase/server";

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

export const ComplianceServiceV3 = {
    /**
     * Registra una verificación de calidad para un lote
     * El trigger en la DB actualizará automáticamente el clinical_status del lote
     */
    async verifyBatchQuality(data: {
        batch_id: string;
        result: 'pass' | 'fail';
        control_lot?: string;
        observations?: string;
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
                verified_by: user.id
            })
            .select()
            .single();

        if (error) throw error;
        return verification;
    },

    /**
     * Obtiene lotes en cuarentena pendientes de verificación
     */
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
     * Registra una evaluación de desempeño para un proveedor
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

        // Cálculo simple de puntaje total
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

    /**
     * Obtiene historial de evaluaciones de proveedores
     */
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

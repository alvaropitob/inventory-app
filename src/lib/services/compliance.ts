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
    reading_type?: string;
    is_out_of_range?: boolean;
    temperature_min_at_reading?: number | null;
    temperature_max_at_reading?: number | null;
    created_at: string;
    user_id: string;
    notes?: string;
    locations?: { name: string; temperature_min?: number | null; temperature_max?: number | null };
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
    supplier_email?: string;
    evaluator_name?: string;
    evaluator_role?: string;
    answers?: Record<string, number | null>;
    applicable_questions?: number;
    points_possible?: number;
    percentage_score?: number;
    rating?: string;
    supplier?: { name: string };
}

export interface MonthlyAlertReport {
    id: string;
    period_month: string;
    verified_device_reagent_alerts: number;
    verified_device_reagent_security_reports: number;
    verified_medicine_biological_reports: number;
    managed_reactivovigilance: number;
    managed_tecnovigilance: number;
    managed_pharmacovigilance: number;
    vigilance_percentage: number;
    notes?: string;
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
        const supabase = await createClient();
        const { data: receptionId, error } = await supabase.rpc("fn_register_technical_reception", {
            p_order_id: data.order_id,
            p_invoice_number: data.invoice_number,
            p_packaging_status: data.packaging_status,
            p_integrity_verified: data.integrity_verified,
            p_reception_temperature: data.reception_temperature,
            p_is_approved: data.is_approved,
            p_notes: data.notes ?? null,
            p_items: data.items.map(item => ({
                catalog_item_id: item.catalog_item_id,
                section_id: item.section_id,
                lot_number: item.lot_number,
                expiration_date: item.expiration_date,
                quantity_received: item.quantity_received,
                location_id: item.location_id,
                unit_price: item.unit_price,
            })),
        });
        if (error) throw error;

        for (const item of data.items) {
            const { error: registrationError } = await supabase.rpc("fn_update_catalog_item_sanitary_registration", {
                p_item_id: item.catalog_item_id,
                p_registration: item.sanitary_registration?.trim() || null,
            });
            if (registrationError) throw registrationError;
        }

        return { success: true, receptionId };
    },

    /**
     * ENVIRONMENTAL LOGS (from V2)
     */
    async recordEnvironmentalLog(data: {
        location_id: string;
        temperature: number;
        humidity?: number;
        notes?: string;
        reading_type?: "am" | "pm";
        is_correction?: boolean;
    }) {
        const supabase = await createClient();
        const { data: readingId, error } = await supabase.rpc("fn_record_environmental_reading", {
            p_location_id: data.location_id,
            p_temperature: data.temperature,
            p_humidity: data.humidity ?? null,
            p_reading_type: data.reading_type || "am",
            p_is_correction: data.is_correction || false,
            p_notes: data.notes ?? null,
        });

        if (error) throw error;
        return { id: readingId as string };
    },

    async hasEnvironmentalReadingForShift(locationId: string, readingDate: string, readingType: "am" | "pm") {
        const start = new Date(`${readingDate}T05:00:00.000Z`);
        const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
        const supabase = await createClient();
        const { data, error } = await supabase
            .from("environmental_readings")
            .select("id")
            .eq("location_id", locationId)
            .eq("reading_type", readingType)
            .gte("created_at", start.toISOString())
            .lt("created_at", end.toISOString())
            .limit(1);

        if (error) throw error;
        return Boolean(data?.length);
    },

    async getEnvironmentalLogs(limit = 50, locationId?: string) {
        const supabase = await createClient();
        let query = supabase
            .from('environmental_readings')
            .select('*, locations(name, temperature_min, temperature_max)')
            .order('created_at', { ascending: false });
        if (locationId) query = query.eq('location_id', locationId);
        const { data, error } = await query.limit(limit);

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

    async getMonthlyAlertReports() {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from('safety_alert_monthly_reports')
            .select('*')
            .order('period_month', { ascending: false });
        if (error) throw error;
        return data as MonthlyAlertReport[];
    },

    async saveMonthlyAlertReport(data: Omit<MonthlyAlertReport, 'id'>) {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Usuario no autenticado');
        const { data: report, error } = await supabase
            .from('safety_alert_monthly_reports')
            .upsert({ ...data, recorded_by: user.id }, { onConflict: 'period_month' })
            .select()
            .single();
        if (error) throw error;
        return report as MonthlyAlertReport;
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

        // A completed quality check must leave the verification queue. A passed
        // batch becomes available for inventory use; a failed one stays blocked.
        const nextStatus = data.result === 'pass' ? 'accepted' : 'rejected';
        const nextAcceptanceStatus = data.result === 'pass' ? 'passed' : 'failed';
        const { error: statusError } = await supabase
            .from('inventory_batches')
            .update({
                status: nextStatus,
                clinical_status: nextStatus,
                acceptance_test_status: nextAcceptanceStatus,
                verified_by: user.id
            })
            .eq('id', data.batch_id)
            .eq('clinical_status', 'quarantine');

        if (statusError) throw statusError;

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
        supplier_email: string;
        evaluation_date: string;
        evaluator_name: string;
        evaluator_role: string;
        answers: Record<string, number | null>;
        applicable_questions: number;
        points_possible: number;
        percentage_score: number;
        rating: string;
        comments?: string;
    }) {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) throw new Error("Usuario no autenticado");

        const total_score = 1 + (data.percentage_score / 25);

        const { data: evaluation, error } = await supabase
            .from('supplier_evaluations')
            .insert({
                supplier_id: data.supplier_id,
                criteria_quality: data.criteria_quality,
                criteria_delivery_time: data.criteria_delivery_time,
                criteria_support: data.criteria_support,
                total_score,
                evaluation_date: data.evaluation_date,
                supplier_email: data.supplier_email,
                evaluator_name: data.evaluator_name,
                evaluator_role: data.evaluator_role,
                answers: data.answers,
                applicable_questions: data.applicable_questions,
                points_possible: data.points_possible,
                percentage_score: data.percentage_score,
                rating: data.rating,
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

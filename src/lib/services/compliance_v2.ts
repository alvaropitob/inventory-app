import { createClient } from "@/lib/supabase/server";

export type IncidentType = 'recall' | 'adverse_event' | 'quality_failure' | 'other';

export interface EnvironmentalLog {
    id: string;
    location_id: string;
    temperature: number;
    humidity?: number;
    recorded_at: string;
    recorded_by: string;
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

export const ComplianceServiceV2 = {
    /**
     * Registra condiciones ambientales de una ubicación
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
            .from('environmental_logs')
            .insert({
                location_id: data.location_id,
                temperature: data.temperature,
                humidity: data.humidity,
                notes: data.notes,
                recorded_by: user.id
            })
            .select()
            .single();

        if (error) throw error;
        return log;
    },

    /**
     * Obtiene historial de logs ambientales
     */
    async getEnvironmentalLogs(limit = 50) {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from('environmental_logs')
            .select('*, locations(name)')
            .order('recorded_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data as EnvironmentalLog[];
    },

    /**
     * Reporta un incidente de seguridad (Recall / Falla de Calidad)
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

        // 1. Registrar el incidente
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

        // 2. Si el incidente es un 'recall' o 'quality_failure', bloquear el lote automáticamente
        if (data.incident_type === 'recall' || data.incident_type === 'quality_failure') {
            const { error: batchUpdateError } = await supabase
                .from('inventory_batches')
                .update({ clinical_status: 'rejected' })
                .eq('id', data.batch_id);

            if (batchUpdateError) throw batchUpdateError;
        }

        return incident;
    },

    /**
     * Obtiene historial de incidentes
     */
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
    }
};

import { createClient } from "@/lib/supabase/server";

export interface Equipment {
  id: string;
  name: string;
  brand?: string;
  model?: string;
  serial_number?: string;
  inventory_number?: string;
  section_id?: string;
  measurement_range?: string;
  sanitary_registration?: string;
  invima_expiration_date?: string;
  risk_classification?: string;
  calibration_frequency?: string;
  maintenance_frequency?: string;
  responsible?: string;
  location_id?: string;
  status: 'active' | 'maintenance' | 'out_of_service';
  last_preventive_maintenance?: string;
  next_preventive_maintenance?: string;
  last_calibration?: string;
  next_calibration?: string;
  location?: { name: string };
  section?: { name: string };
}

export interface MaintenanceRecord {
  id: string;
  equipment_id: string;
  type: 'preventive' | 'corrective' | 'calibration';
  execution_date: string;
  scheduled_date?: string;
  performed_by?: string;
  provider_name?: string;
  description?: string;
  result?: string;
  next_due_date?: string;
}

export const EquipmentService = {
  async getEquipments() {
    const supabase = await createClient();
    return await supabase
      .from('equipments')
      .select('*, location:locations(name), section:sections(name)')
      .order('name');
  },

  async getEquipmentById(id: string) {
    const supabase = await createClient();
    return await supabase
      .from('equipments')
      .select('*, location:locations(name), section:sections(name)')
      .eq('id', id)
      .single();
  },

  async upsertEquipment(data: Partial<Equipment>) {
    const supabase = await createClient();
    const { data: equipment, error } = await supabase
      .from('equipments')
      .upsert(data)
      .select()
      .single();
    if (error) throw error;
    return equipment;
  },

  async getMaintenanceHistory(equipmentId: string) {
    const supabase = await createClient();
    return await supabase
      .from('maintenance_records')
      .select('*')
      .eq('equipment_id', equipmentId)
      .order('execution_date', { ascending: false });
  },

  async addMaintenanceRecord(data: Partial<MaintenanceRecord>) {
    const supabase = await createClient();
    if (!data.equipment_id || !data.type || !data.execution_date || !data.scheduled_date || !data.performed_by) {
      throw new Error('Faltan datos obligatorios para registrar el mantenimiento.');
    }

    const { data: record, error } = await supabase
      .rpc('fn_add_maintenance_record', {
        p_equipment_id: data.equipment_id,
        p_type: data.type,
        p_execution_date: data.execution_date,
        p_scheduled_date: data.scheduled_date,
        p_performed_by: data.performed_by,
        p_provider_name: data.provider_name ?? null,
        p_description: data.description ?? null,
        p_result: data.result ?? null,
        p_next_due_date: data.next_due_date ?? null,
      })
      .single();

    if (error) throw error;
    return record;
  }
};

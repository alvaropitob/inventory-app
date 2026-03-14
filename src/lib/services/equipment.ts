import { createClient } from "@/lib/supabase/server";

export interface Equipment {
  id: string;
  name: string;
  brand?: string;
  model?: string;
  serial_number?: string;
  location_id?: string;
  status: 'active' | 'maintenance' | 'out_of_service';
  last_preventive_maintenance?: string;
  next_preventive_maintenance?: string;
  last_calibration?: string;
  next_calibration?: string;
  location?: { name: string };
}

export interface MaintenanceRecord {
  id: string;
  equipment_id: string;
  type: 'preventive' | 'corrective' | 'calibration';
  execution_date: string;
  performed_by?: string;
  description?: string;
  result?: string;
  next_due_date?: string;
}

export const EquipmentService = {
  async getEquipments() {
    const supabase = await createClient();
    return await supabase
      .from('equipments')
      .select('*, location:locations(name)')
      .order('name');
  },

  async getEquipmentById(id: string) {
    const supabase = await createClient();
    return await supabase
      .from('equipments')
      .select('*, location:locations(name)')
      .eq('id', id)
      .single();
  },

  async upsertEquipment(data: Partial<Equipment>) {
    const supabase = await createClient();
    return await supabase
      .from('equipments')
      .upsert(data)
      .select()
      .single();
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
    
    // 1. Insert record
    const { data: record, error } = await supabase
      .from('maintenance_records')
      .insert(data)
      .select()
      .single();
      
    if (error) throw error;

    // 2. Update equipment dates if applicable
    const updateData: Partial<Equipment> = {};
    if (data.type === 'preventive') {
      updateData.last_preventive_maintenance = data.execution_date;
      updateData.next_preventive_maintenance = data.next_due_date;
    } else if (data.type === 'calibration') {
      updateData.last_calibration = data.execution_date;
      updateData.next_calibration = data.next_due_date;
    }

    if (Object.keys(updateData).length > 0) {
      await supabase
        .from('equipments')
        .update(updateData)
        .eq('id', data.equipment_id);
    }

    return record;
  }
};

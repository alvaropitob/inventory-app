import { createClient } from "@/lib/supabase/server";
import { type PostgrestError } from "@supabase/supabase-js";
import { AuditService } from "./audit";

export interface InventoryBatch {
  id?: string;
  item_id: string;
  location_id: string;
  supplier_id?: string | null;
  batch_number: string;
  expiration_date: string;
  initial_quantity: number;
  current_stock: number;
  opened_units_remaining?: number;
  opened_units_per_package?: number;
  received_by?: string | null;
  notes?: string | null;
}

export class StockService {
  static async receiveStock(data: {
    item_id: string;
    location_id: string;
    supplier_id: string | null;
    batch_number: string;
    expiration_date: string;
    quantity: number;
    received_by: string;
    notes?: string | null;
  }) {
    const supabase = await createClient();
    const { data: batchId, error } = await supabase.rpc('fn_receive_inventory_batch', {
      p_item_id: data.item_id,
      p_location_id: data.location_id,
      p_supplier_id: data.supplier_id,
      p_batch_number: data.batch_number,
      p_expiration_date: data.expiration_date,
      p_quantity: data.quantity,
      p_received_by: data.received_by,
      p_notes: data.notes || null,
    });
    if (error) return { data: null, error };
    return { data: { id: batchId as string }, error: null };
  }

  static async consumeStock(data: {
    batch_id: string;
    quantity: number;
    consumed_by: string;
    reason: string;
    equipment?: string;
    mark_as_opened?: boolean;
    reconstituted?: boolean;
    fefo_deviation?: boolean;
    justification_reason?: string;
  }): Promise<{ data: { success: true } | null; error: PostgrestError | { message: string } | null }> {
    const supabase = await createClient();
    const { error } = await supabase.rpc("fn_consume_inventory_batch", {
      p_batch_id: data.batch_id,
      p_quantity: data.quantity,
      p_consumed_by: data.consumed_by,
      p_reason: data.reason,
      p_equipment_name: data.equipment || null,
      p_mark_as_opened: data.mark_as_opened || false,
      p_reconstituted: data.reconstituted || false,
      p_fefo_deviation: data.fefo_deviation || false,
      p_justification_reason: data.justification_reason || null,
    });
    if (error) return { data: null, error };

    await AuditService.logAction({
      table_name: 'inventory_batches',
      record_id: data.batch_id,
      action: 'UPDATE',
      new_data: {
        quantity_consumed: data.quantity,
        reason: data.reason,
        fefo_deviation: data.fefo_deviation || false,
        justification: data.justification_reason || null,
        opened: !!data.mark_as_opened,
      },
      user_id: data.consumed_by,
      notes: `Consumo de stock: ${data.quantity} unidades del lote ${data.batch_id}`,
    });

    return { data: { success: true }, error: null };
  }

  static async consumeFractionalStock(data: {
    batch_id: string;
    units: number;
    units_per_package: number;
    consumed_by: string;
    reason: string;
    equipment?: string;
    fefo_deviation?: boolean;
    justification_reason?: string;
  }): Promise<{ data: { success: true } | null; error: PostgrestError | { message: string } | null }> {
    const supabase = await createClient();
    const { error } = await supabase.rpc("fn_consume_fractional_inventory_batch", {
      p_batch_id: data.batch_id,
      p_units: data.units,
      p_units_per_package: data.units_per_package,
      p_consumed_by: data.consumed_by,
      p_reason: data.reason,
      p_equipment_name: data.equipment || null,
      p_fefo_deviation: data.fefo_deviation || false,
      p_justification_reason: data.justification_reason || null,
    });
    if (error) return { data: null, error };
    return { data: { success: true }, error: null };
  }

  static async transferStock(data: {
    batch_id: string;
    destination_location_id: string;
    quantity: number;
    transferred_by: string;
    reason?: string;
  }): Promise<{ data: { success: true } | null; error: PostgrestError | { message: string } | null }> {
    const supabase = await createClient();
    const { error } = await supabase.rpc("fn_transfer_inventory_batch", {
      p_batch_id: data.batch_id,
      p_destination_location_id: data.destination_location_id,
      p_quantity: data.quantity,
      p_transferred_by: data.transferred_by,
      p_reason: data.reason || null,
    });
    if (error) return { data: null, error };
    return { data: { success: true }, error: null };
  }

  static async getAllMovements() {
    const supabase = await createClient();
    return await supabase
      .from('stock_movements')
      .select(`
        *,
        batch:inventory_batches(
          item_id,
          location_id,
          batch_number, 
          expiration_date,
          item:catalog_items(technical_name, commercial_name, internal_code),
          location:locations(id, name)
        ),
        user:users(full_name, username)
      `)
      .order('created_at', { ascending: false });
  }

  static async getAllFractionalMovements() {
    const supabase = await createClient();
    return await supabase
      .from('inventory_fractional_movements')
      .select(`
        *,
        batch:inventory_batches(
          item_id,
          location_id,
          batch_number,
          expiration_date,
          item:catalog_items(technical_name, commercial_name, internal_code),
          location:locations(id, name)
        ),
        user:users(full_name, username)
      `)
      .order('created_at', { ascending: false });
  }

  static async getAllBatches() {
    const supabase = await createClient();
    return await supabase
      .from('inventory_batches')
      .select(`
        *,
        item:catalog_items(id, technical_name, commercial_name, commercial_presentation, purchase_unit, internal_code, minimum_stock_threshold, maximum_stock_threshold, section_id, sections(name)),
        location:locations(name, section_id)
      `)
      .order('expiration_date', { ascending: true });
  }

  static async getBatchesByItem(itemId: string) {
    const supabase = await createClient();
    return await supabase
      .from('inventory_batches')
      .select(`
        *,
        location:locations(name)
      `)
      .eq('item_id', itemId)
      .order('expiration_date', { ascending: true });
  }

  static async getLatestBatchByItem(itemId: string) {
    const supabase = await createClient();
    return await supabase
      .from('inventory_batches')
      .select("*")
      .eq('item_id', itemId)
      .order('created_at', { ascending: false })
      .maybeSingle();
  }

  static async getBatchById(id: string) {
    const supabase = await createClient();
    return await supabase
      .from('inventory_batches')
      .select(`
        *,
        item:catalog_items(technical_name, commercial_name, internal_code),
        location:locations(name)
      `)
      .eq('id', id)
      .single();
  }
}

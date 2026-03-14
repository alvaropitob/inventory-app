import { createClient } from "@/lib/supabase/server";

export interface InventoryBatch {
  id?: string;
  item_id: string;
  location_id: string;
  supplier_id?: string | null;
  batch_number: string;
  expiration_date: string;
  initial_quantity: number;
  current_stock: number;
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

    // 1. Check if the batch already exists for this item
    const { data: existingBatch } = await supabase
      .from('inventory_batches')
      .select('id')
      .eq('item_id', data.item_id)
      .eq('batch_number', data.batch_number)
      .maybeSingle();

    let batchId: string;

    if (existingBatch) {
      // NOTE: We DO NOT manually update current_stock here! 
      // The trg_stock_sync database trigger will automatically add the quantity to current_stock
      // when we insert the 'entry' into stock_movements below.
      const { data: updatedBatch, error: updateError } = await supabase
        .from('inventory_batches')
        .update({
          location_id: data.location_id, // Update location in case it changed
          expiration_date: data.expiration_date // Update expiration in case it was corrected
        })
        .eq('id', existingBatch.id)
        .select()
        .single();
      
      if (updateError) return { data: null, error: updateError };
      batchId = updatedBatch.id;
    } else {
      // Create the batch. Set current_stock to 0 because the trigger on stock_movements will increment it!
      const { data: newBatch, error: batchError } = await supabase
        .from('inventory_batches')
        .insert({
          item_id: data.item_id,
          location_id: data.location_id,
          supplier_id: data.supplier_id,
          batch_number: data.batch_number,
          expiration_date: data.expiration_date,
          initial_quantity: data.quantity,
          current_stock: 0, // IMPORTANT: initialized to 0, trigger handles increment
          received_by: data.received_by,
          notes: data.notes,
          status: 'accepted'
        })
        .select()
        .single();

      if (batchError) return { data: null, error: batchError };
      batchId = newBatch.id;
    }

    // 2. Create the stock movement. The 'entry' trigger will fire and update inventory_batches.current_stock
    const { error: movementError } = await supabase
      .from('stock_movements')
      .insert({
        batch_id: batchId,
        user_id: data.received_by,
        movement_type: 'entry',
        quantity: data.quantity,
        reason: data.notes || 'Ingreso de mercancía'
      });

    if (movementError) return { data: null, error: movementError };

    return { data: { id: batchId }, error: null };
  }

  static async consumeStock(data: {
    batch_id: string;
    quantity: number;
    consumed_by: string;
    reason: string;
  }) {
    const supabase = await createClient();

    // 1. Check if batch has enough stock
    const { data: batch, error: batchError } = await supabase
      .from('inventory_batches')
      .select('current_stock, item_id, batch_number')
      .eq('id', data.batch_id)
      .single();

    if (batchError) return { data: null, error: batchError };
    
    if (batch.current_stock < data.quantity) {
      return { data: null, error: { message: `Stock insuficiente. Lote: ${batch.batch_number} tiene solo ${batch.current_stock} unidades disponibles.` }};
    }

    // 2. Insert into stock_movements (Trigger will automatically deduct from inventory_batches.current_stock)
    const { error: movementError } = await supabase
      .from('stock_movements')
      .insert({
        batch_id: data.batch_id,
        user_id: data.consumed_by,
        movement_type: 'exit',
        quantity: data.quantity,
        reason: data.reason || 'Consumo operativo'
      });

    if (movementError) return { data: null, error: movementError };

    return { data: { success: true }, error: null };
  }

  static async getAllMovements() {
    const supabase = await createClient();
    return await supabase
      .from('stock_movements')
      .select(`
        *,
        batch:inventory_batches(
          batch_number, 
          expiration_date,
          item:catalog_items(technical_name, commercial_name, internal_code),
          location:locations(name)
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
        item:catalog_items(technical_name, commercial_name, internal_code, minimum_stock_threshold),
        location:locations(name)
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
}

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
      .select('id, current_stock')
      .eq('item_id', data.item_id)
      .eq('batch_number', data.batch_number)
      .maybeSingle();

    let batchId: string;

    if (existingBatch) {
      // Update existing batch stock
      const { data: updatedBatch, error: updateError } = await supabase
        .from('inventory_batches')
        .update({
          current_stock: (existingBatch.current_stock || 0) + data.quantity,
          location_id: data.location_id, // Update location in case it changed
          expiration_date: data.expiration_date // Update expiration in case it was corrected
        })
        .eq('id', existingBatch.id)
        .select()
        .single();
      
      if (updateError) throw updateError;
      batchId = updatedBatch.id;
    } else {
      // Create the batch
      const { data: newBatch, error: batchError } = await supabase
        .from('inventory_batches')
        .insert({
          item_id: data.item_id,
          location_id: data.location_id,
          supplier_id: data.supplier_id,
          batch_number: data.batch_number,
          expiration_date: data.expiration_date,
          initial_quantity: data.quantity,
          current_stock: data.quantity,
          received_by: data.received_by,
          notes: data.notes,
          status: 'accepted'
        })
        .select()
        .single();

      if (batchError) throw batchError;
      batchId = newBatch.id;
    }

    // 2. Create the stock movement
    const { error: movementError } = await supabase
      .from('stock_movements')
      .insert({
        batch_id: batchId,
        user_id: data.received_by,
        movement_type: 'entry',
        quantity: data.quantity,
        reason: data.notes || 'Ingreso de mercancía'
      });

    if (movementError) throw movementError;

    return { id: batchId };
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

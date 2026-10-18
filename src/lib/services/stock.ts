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

    // Audit Log
    await AuditService.logAction({
      table_name: 'inventory_batches',
      record_id: batchId,
      action: existingBatch ? 'UPDATE' : 'INSERT',
      new_data: data,
      user_id: data.received_by,
      notes: existingBatch ? 'Actualización de stock de lote existente' : 'Ingreso de nuevo lote'
    });

    return { data: { id: batchId }, error: null };
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

    // 1. Check if batch has enough stock
    const { data: batch, error: batchError } = await supabase
      .from('inventory_batches')
      .select('current_stock, item_id, batch_number, opening_date')
      .eq('id', data.batch_id)
      .single();

    if (batchError) return { data: null, error: batchError };
    
    if (batch.current_stock < data.quantity) {
      return { data: null, error: { message: `Stock insuficiente. Lote: ${batch.batch_number} tiene solo ${batch.current_stock} unidades disponibles.` }};
    }

    // 2. Prepare movement reason including FEFO deviation if present
    let finalReason = data.reason;
    if (data.fefo_deviation && data.justification_reason) {
      finalReason = `[DESVIACIÓN FEFO]: ${data.justification_reason} | Motivo: ${data.reason}`;
    }

    // 3. Insert into stock_movements (Trigger will automatically deduct from inventory_batches.current_stock)
    const { error: movementError } = await supabase
      .from('stock_movements')
      .insert({
        batch_id: data.batch_id,
        user_id: data.consumed_by,
        movement_type: 'exit',
        quantity: data.quantity,
        reason: finalReason,
        equipment_name: data.equipment
      });

    if (movementError) return { data: null, error: movementError };

    // 4. If requested, update opening_date and/or reconstitution_datetime
    const batchUpdates: Record<string, string> = {};
    if (data.mark_as_opened && !batch.opening_date) {
      batchUpdates.opening_date = new Date().toISOString();
    }
    if (data.reconstituted) {
      batchUpdates.reconstitution_datetime = new Date().toISOString();
    }

    if (Object.keys(batchUpdates).length > 0) {
      await supabase
        .from('inventory_batches')
        .update(batchUpdates)
        .eq('id', data.batch_id);
    }

    // Audit Log
    await AuditService.logAction({
      table_name: 'inventory_batches',
      record_id: data.batch_id,
      action: 'UPDATE',
      new_data: {
        quantity_consumed: data.quantity,
        reason: finalReason,
        fefo_deviation: data.fefo_deviation || false,
        justification: data.justification_reason || null,
        opened: !!data.mark_as_opened
      },
      user_id: data.consumed_by,
      notes: `Consumo de stock: ${data.quantity} unidades del lote ${batch.batch_number}`
    });

    return { data: { success: true }, error: null };
  }

  static async discardStock(data: {
    batch_id: string;
    quantity: number;
    discarded_by: string;
    reason: string;
    disposal_method?: string;
  }): Promise<{ data: { success: true } | null; error: PostgrestError | { message: string } | null }> {
    const supabase = await createClient();

    // 1. Check if batch exists and has enough stock
    const { data: batch, error: batchError } = await supabase
      .from('inventory_batches')
      .select('current_stock, item_id, batch_number, status')
      .eq('id', data.batch_id)
      .single();

    if (batchError) return { data: null, error: batchError };

    if (batch.current_stock < data.quantity) {
      return { data: null, error: { message: `Stock insuficiente para dar de baja. Lote: ${batch.batch_number} tiene solo ${batch.current_stock} unidades.` }};
    }

    const fullReason = data.disposal_method 
      ? `Baja/Disposición: ${data.reason} (Método: ${data.disposal_method})`
      : `Baja/Disposición: ${data.reason}`;

    // 2. Insert into stock_movements with movement_type = 'discard'
    const { error: movementError } = await supabase
      .from('stock_movements')
      .insert({
        batch_id: data.batch_id,
        user_id: data.discarded_by,
        movement_type: 'discard',
        quantity: data.quantity,
        reason: fullReason,
      });

    if (movementError) return { data: null, error: movementError };

    // 3. If remaining stock is 0 and it was discarded due to expiration, ensure status is expired or rejected
    if (batch.current_stock - data.quantity === 0) {
      await supabase
        .from('inventory_batches')
        .update({ status: 'rejected' })
        .eq('id', data.batch_id);
    }

    // Audit Log
    await AuditService.logAction({
      table_name: 'inventory_batches',
      record_id: data.batch_id,
      action: 'UPDATE',
      new_data: { quantity_discarded: data.quantity, reason: fullReason },
      user_id: data.discarded_by,
      notes: `Baja técnica / descarte: ${data.quantity} unidades del lote ${batch.batch_number}`
    });

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

    // 1. Obtener lote origen y ubicaciones
    const { data: batch, error: batchError } = await supabase
      .from('inventory_batches')
      .select('*, locations(name)')
      .eq('id', data.batch_id)
      .single();

    if (batchError) return { data: null, error: batchError };

    if (batch.location_id === data.destination_location_id) {
      return { data: null, error: { message: "La ubicación destino debe ser diferente a la ubicación actual." } };
    }

    if (batch.current_stock < data.quantity) {
      return { data: null, error: { message: `Stock insuficiente para trasladar. Disponible: ${batch.current_stock} unidades.` } };
    }

    const { data: destLoc } = await supabase
      .from('locations')
      .select('name')
      .eq('id', data.destination_location_id)
      .single();

    const originName = (batch.locations as { name: string } | null)?.name || "Ubicación actual";
    const destName = destLoc?.name || "Ubicación destino";
    const transferNote = `Traslado interno de ${data.quantity} unid. desde [${originName}] hasta [${destName}]. ${data.reason || ""}`;

    // Si es un traslado total (todo el stock del lote)
    if (batch.current_stock === data.quantity) {
      const { error: updateError } = await supabase
        .from('inventory_batches')
        .update({ location_id: data.destination_location_id })
        .eq('id', batch.id);

      if (updateError) return { data: null, error: updateError };

      // Registrar en stock_movements el registro auditable de traslado
      await supabase.from('stock_movements').insert({
        batch_id: batch.id,
        user_id: data.transferred_by,
        movement_type: 'adjustment',
        quantity: 0,
        reason: transferNote,
      });
    } else {
      // Traslado parcial:
      // 1. Descontar del lote origen
      await supabase.from('stock_movements').insert({
        batch_id: batch.id,
        user_id: data.transferred_by,
        movement_type: 'exit',
        quantity: data.quantity,
        reason: `Salida por traslado hacia [${destName}]`,
      });

      // 2. Comprobar si ya existe el lote en la ubicación destino
      const { data: destBatch } = await supabase
        .from('inventory_batches')
        .select('id')
        .eq('item_id', batch.item_id)
        .eq('batch_number', batch.batch_number)
        .eq('location_id', data.destination_location_id)
        .maybeSingle();

      let targetBatchId = destBatch?.id;
      if (!targetBatchId) {
        const { data: newBatch, error: newBatchErr } = await supabase
          .from('inventory_batches')
          .insert({
            item_id: batch.item_id,
            location_id: data.destination_location_id,
            supplier_id: batch.supplier_id,
            batch_number: batch.batch_number,
            expiration_date: batch.expiration_date,
            initial_quantity: data.quantity,
            current_stock: 0,
            status: batch.status,
            acceptance_test_status: batch.acceptance_test_status,
            received_by: data.transferred_by,
            notes: `Lote generado por traslado desde ${originName}`,
          })
          .select('id')
          .single();

        if (newBatchErr) return { data: null, error: newBatchErr };
        targetBatchId = newBatch.id;
      }

      // 3. Registrar ingreso en lote destino
      await supabase.from('stock_movements').insert({
        batch_id: targetBatchId,
        user_id: data.transferred_by,
        movement_type: 'entry',
        quantity: data.quantity,
        reason: `Ingreso por traslado desde [${originName}]`,
      });
    }

    // Auditoría
    await AuditService.logAction({
      table_name: 'inventory_batches',
      record_id: data.batch_id,
      action: 'UPDATE',
      new_data: { quantity: data.quantity, destination: data.destination_location_id },
      user_id: data.transferred_by,
      notes: transferNote,
    });

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

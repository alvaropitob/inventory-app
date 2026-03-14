import { createClient } from "@/lib/supabase/server";

export type OrderStatus = 'draft' | 'requested' | 'partially_received' | 'completed' | 'cancelled';

export interface PurchaseOrder {
  id?: string;
  order_number: string;
  supplier_id: string;
  created_by: string;
  status: OrderStatus;
  expected_delivery_date?: string | null;
  notes?: string | null;
  total_estimated_value?: number;
  created_at?: string;
  updated_at?: string;
  
  // joined relations
  supplier?: { id: string; name: string; contact_name?: string | null; contact_email?: string | null };
  creator?: { id: string; full_name: string; email: string };
  items?: PurchaseOrderItem[];
}

export interface PurchaseOrderItem {
  id?: string;
  purchase_order_id: string;
  item_id: string;
  quantity_requested: number;
  quantity_received?: number;
  estimated_unit_price?: number;
  
  // joined relations
  catalog_item?: { id: string; internal_code: string; technical_name: string; commercial_name: string };
}

export const OrderService = {
  async getOrders(filters?: { status?: OrderStatus; supplier_id?: string }) {
    const supabase = await createClient();
    let query = supabase
      .from("purchase_orders")
      .select(`
        *,
        supplier:suppliers!supplier_id(id, name),
        creator:users!created_by(id, full_name, email)
      `)
      .order("created_at", { ascending: false });

    if (filters?.status) {
      query = query.eq("status", filters.status);
    }
    if (filters?.supplier_id) {
      query = query.eq("supplier_id", filters.supplier_id);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as PurchaseOrder[];
  },

  async getOrderById(id: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("purchase_orders")
      .select(`
        *,
        supplier:suppliers!supplier_id(id, name, contact_name, contact_email),
        creator:users!created_by(id, full_name, email),
        items:purchase_order_items(
          *,
          catalog_item:catalog_items(id, internal_code, technical_name, commercial_name)
        )
      `)
      .eq("id", id)
      .single();

    if (error) throw error;
    return data as PurchaseOrder;
  },

  async createOrder(order: Partial<PurchaseOrder>, items: Partial<PurchaseOrderItem>[]) {
    const supabase = await createClient();
    
    // Auto-generate order number if not provided
    if (!order.order_number) {
      const datePart = new Date().toISOString().slice(2, 10).replace(/-/g, '');
      const randomPart = Math.floor(1000 + Math.random() * 9000);
      order.order_number = `PO-${datePart}-${randomPart}`;
    }

    const { data: newOrder, error: orderError } = await supabase
      .from("purchase_orders")
      .insert([order])
      .select()
      .single();

    if (orderError) throw orderError;

    if (items && items.length > 0) {
      const itemsToInsert = items.map(item => ({
        ...item,
        purchase_order_id: newOrder.id
      }));

      const { error: itemsError } = await supabase
        .from("purchase_order_items")
        .insert(itemsToInsert);
        
      if (itemsError) {
        // Rollback strategy is manual since we lack transaction control from REST directly,
        // but it's safe enough for now.
        await supabase.from("purchase_orders").delete().eq("id", newOrder.id);
        throw itemsError;
      }
    }

    return newOrder;
  },

  async updateOrderStatus(id: string, status: OrderStatus) {
    const supabase = await createClient();
    const { error } = await supabase
      .from("purchase_orders")
      .update({ status })
      .eq("id", id);
      
    if (error) throw error;
    return true;
  },

  async deleteDraftOrder(id: string) {
    const supabase = await createClient();
    const { error } = await supabase
      .from("purchase_orders")
      .delete()
      .eq("id", id)
      .eq("status", "draft"); // Enforce only draft can be deleted
      
    if (error) throw error;
    return true;
  }
};

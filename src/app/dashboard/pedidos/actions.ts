"use server";

import { createClient } from "@/lib/supabase/server";
import { OrderService } from "@/lib/services/orders";

export async function createPurchaseOrder(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "No autorizado" };
  }

  const supplier_id = formData.get("supplier_id") as string;
  if (!supplier_id) {
    return { error: "El proveedor es obligatorio" };
  }

  const expected_delivery_date = formData.get("expected_delivery_date") as string;
  const notes = formData.get("notes") as string;
  const total_estimated_value = Number(formData.get("total_estimated_value") || 0);
  
  const itemsStr = formData.get("items") as string;
  if (!itemsStr) {
    return { error: "Debe agregar productos al pedido" };
  }

  let items = [];
  try {
    items = JSON.parse(itemsStr);
  } catch (e) {
    return { error: "Formato de productos inválido" };
  }

  if (items.length === 0) {
    return { error: "El pedido debe contener al menos un producto" };
  }

  const orderItems = items.map((i: any) => ({
    item_id: i.item_id,
    quantity_requested: Number(i.quantity),
    estimated_unit_price: Number(i.price)
  }));

  try {
    await OrderService.createOrder({
      supplier_id,
      expected_delivery_date: expected_delivery_date || null,
      notes: notes || null,
      total_estimated_value,
      created_by: user.id,
      status: "draft" // Everything starts as draft
    }, orderItems);

    return { success: true };
  } catch (error: any) {
    console.error("Error creating order:", error);
    return { error: error.message || "No se pudo crear el pedido" };
  }
}

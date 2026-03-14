"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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
  } catch {
    return { error: "Formato de productos inválido" };
  }

  if (items.length === 0) {
    return { error: "El pedido debe contener al menos un producto" };
  }

  const totalValue = items.reduce((sum: number, item: { price: number, quantity: number }) => sum + (Number(item.quantity) * Number(item.price)), 0);

  const orderItems = items.map((i: { item_id: string, quantity: number, price: number }) => ({
    item_id: i.item_id,
    quantity_requested: Number(i.quantity),
    estimated_unit_price: Number(i.price)
  }));

  try {
    const order = await OrderService.createOrder({
      supplier_id,
      expected_delivery_date: expected_delivery_date || null,
      notes: notes || null,
      total_estimated_value: totalValue, // Use the calculated totalValue
      created_by: user.id,
      status: "draft" // Everything starts as draft
    }, orderItems);

    revalidatePath("/dashboard/pedidos");
    redirect(`/dashboard/pedidos/${order.id}`);
  } catch (error) {
    console.error("Create Order Error:", error);
    const message = encodeURIComponent(error instanceof Error ? error.message : "Error al procesar el pedido");
    redirect(`/dashboard/pedidos?error=${message}`);
  }
}

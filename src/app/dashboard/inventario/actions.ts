"use server";

import { CatalogService } from "@/lib/services/catalog";
import { StockService } from "@/lib/services/stock";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function handleCatalogAction(formData: FormData) {
  const id = formData.get("id") as string;
  const sectionId = formData.get("section_id") as string;
  
  // Fetch sections to get category_id and avoid closure issues
  const { data: sections } = await CatalogService.getSections();
  const selectedSection = sections?.find(s => s.id === sectionId);
  
  try {
    const data = {
      id: id || undefined,
      internal_code: formData.get("internal_code") as string,
      technical_name: formData.get("technical_name") as string,
      commercial_name: (formData.get("commercial_name") as string) || null,
      category_id: (selectedSection as any)?.category_id || null,
      section_id: sectionId || null, 
      supplier_id: (formData.get("supplier_id") as string) || null,
      is_active: true,
    };

    const { data: item, error: upsertError } = await CatalogService.upsertCatalogItem(data);
    
    if (upsertError) {
      console.error("Upsert Error:", upsertError);
      const errorMsg = encodeURIComponent(upsertError.message || "Error al guardar el producto");
      redirect(`/dashboard/inventario?view=entradas&error=${errorMsg}`);
    }

    // Register physical stock entry if quantity is provided
    const quantity = Number(formData.get("quantity"));
    const batchNumber = formData.get("batch_number") as string;
    const expirationDate = formData.get("expiration_date") as string;
    const locationId = formData.get("location_id") as string;

    if (item && quantity > 0 && batchNumber && expirationDate && locationId) {
      // If editing, check if we are just re-submitting the same batch info
      let shouldReceive = true;
      if (id) {
        const { data: latestBatch } = await StockService.getLatestBatchByItem(id);
        if (latestBatch && 
            latestBatch.batch_number === batchNumber && 
            latestBatch.location_id === locationId &&
            latestBatch.expiration_date === expirationDate) {
          shouldReceive = false;
        }
      }

      if (shouldReceive) {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          const { error: stockError } = await StockService.receiveStock({
            item_id: item.id,
            location_id: locationId,
            supplier_id: data.supplier_id,
            batch_number: batchNumber,
            expiration_date: expirationDate,
            quantity: quantity,
            received_by: user.id,
            notes: `Ingreso registrado vía formulario de inventario`
          });
          if (stockError) {
            console.error("Stock Error:", stockError);
            if (stockError.code === '23505') { // Unique violation
              // Silence this specific error if it happens despite our check
            } else {
              throw stockError;
            }
          }
        }
      }
    }
    
    revalidatePath("/dashboard/inventario");
    // Always redirect to refresh and show data
    redirect("/dashboard/inventario?view=entradas");
  } catch (error: any) {
    if (error.digest?.startsWith('NEXT_REDIRECT')) throw error;
    console.error("Fatal Action Error:", error);
    const errorMsg = encodeURIComponent(error.message || "Error inesperado");
    redirect(`/dashboard/inventario?view=entradas&error=${errorMsg}`);
  }
}

export async function handleDelete(id: string) {
  await CatalogService.deleteCatalogItem(id);
  revalidatePath("/dashboard/inventario");
}

export async function toggleStatus(id: string, currentStatus: boolean) {
  await CatalogService.toggleCatalogItem(id, !currentStatus);
  revalidatePath("/dashboard/inventario");
}

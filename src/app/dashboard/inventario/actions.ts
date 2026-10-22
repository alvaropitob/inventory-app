"use server";

import { CatalogService } from "@/lib/services/catalog";
import { StockService } from "@/lib/services/stock";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/supabase/authorization";
import { validateCatalogProduct } from "@/lib/validation/catalog";

export async function handleCatalogAction(formData: FormData) {
  await requireRole(["admin", "supervisor"]);
  const id = formData.get("id") as string;
  const sectionId = formData.get("section_id") as string;
  const productType = String(formData.get("product_type") || "");
  const value = (key: string) => String(formData.get(key) || "").trim();
  const validationError = validateCatalogProduct(Object.fromEntries([
    "product_type", "internal_code", "technical_name", "purchase_unit", "commercial_presentation",
    "active_ingredient", "dosage_form", "concentration", "sanitary_registration", "brand",
    "shelf_life", "series", "product_description", "risk_classification", "supplier_id",
  ].map(field => [field, value(field)])));
  if (validationError) redirect(`/dashboard/inventario?view=entradas&error=${encodeURIComponent(validationError)}`);
  
  // Fetch sections to get category_id and avoid closure issues
  const { data: sections } = await CatalogService.getSections();
  const selectedSection = sections?.find(s => s.id === sectionId);
  
  try {
    const data = {
      id: id || undefined,
      internal_code: formData.get("internal_code") as string,
      technical_name: formData.get("technical_name") as string,
      commercial_name: (formData.get("commercial_name") as string) || null,
      sanitary_registration: value("sanitary_registration") || null,
      product_type: productType as "medicamento" | "dispositivo_medico" | "reactivo" | "insumo",
      series: value("series") || null,
      brand: value("brand") || null,
      product_description: value("product_description") || null,
      active_ingredient: value("active_ingredient") || null,
      dosage_form: value("dosage_form") || null,
      concentration: value("concentration") || null,
      commercial_presentation: value("commercial_presentation") || null,
      shelf_life: value("shelf_life") || null,
      risk_classification: (value("risk_classification") as "I" | "II" | "IIA" | "IIB" | "III" | "not_applicable") || "not_applicable",
      purchase_unit: (formData.get("purchase_unit") as string) || "Unidad",
      category_id: (selectedSection as { category_id: string | null })?.category_id || null,
      section_id: sectionId || null, 
      supplier_id: value("supplier_id") && value("supplier_id") !== "not_applicable" ? value("supplier_id") : null,
      is_active: true,
    };

    const { data: item, error: upsertError } = await CatalogService.upsertCatalogItem(data);
    
    if (upsertError) {
      console.error("Upsert Error:", upsertError);
      const errorMsg = encodeURIComponent(upsertError.message || "Error al guardar el producto");
      redirect(`/dashboard/inventario?view=entradas&error=${errorMsg}`);
    }

    // Register physical stock entry if quantity is provided
    const rawQuantity = String(formData.get("quantity") || "").trim();
    const quantity = rawQuantity ? Number(rawQuantity) : 0;
    const batchNumber = formData.get("batch_number") as string;
    const expirationDate = String(formData.get("expiration_date") || "").trim();
    const locationId = String(formData.get("location_id") || "").trim();
    const hasAnyBatchData = Boolean(rawQuantity || String(batchNumber || "").trim() || expirationDate || locationId);

    if (hasAnyBatchData && (!Number.isSafeInteger(quantity) || quantity < 1 || !String(batchNumber || "").trim() || !expirationDate || !locationId)) {
      throw new Error("Para registrar existencias, completa cantidad, lote, vencimiento y ubicación.");
    }
    if (item && quantity > 0) {
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
            throw stockError;
          }
        }
      }
    }
    
    revalidatePath("/dashboard/inventario");
    // Always redirect to refresh and show data
    redirect("/dashboard/inventario?view=entradas");
  } catch (error) {
    if (error instanceof Error && (error as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw error;
    console.error("Fatal Action Error:", error);
    const errorMsg = encodeURIComponent(error instanceof Error ? error.message : "Error inesperado");
    redirect(`/dashboard/inventario?view=entradas&error=${errorMsg}`);
  }
}

export async function handleDelete(id: string) {
  await requireRole(["admin"]);
  await CatalogService.deleteCatalogItem(id);
  revalidatePath("/dashboard/inventario");
}

export async function toggleStatus(id: string, currentStatus: boolean) {
  await requireRole(["admin", "supervisor"]);
  await CatalogService.toggleCatalogItem(id, !currentStatus);
  revalidatePath("/dashboard/inventario");
}

export async function handleConsumeAction(formData: FormData) {
  const batchId = formData.get("batch_id") as string;
  const quantity = Number(formData.get("quantity"));
  const reason = formData.get("reason") as string;
  const equipment = formData.get("equipment") as string;
  const fefoDeviation = formData.get("fefo_deviation") === "true";
  const justificationReason = formData.get("justification_reason") as string;
  const markAsOpened = formData.get("mark_as_opened") === "true";
  const reconstituted = formData.get("reconstituted") === "true";

  try {
    const { user } = await requireRole(["admin", "operator"]);
    if (!batchId || !Number.isSafeInteger(quantity) || quantity <= 0) throw new Error("Lote o cantidad no válidos");

    if (fefoDeviation && (!justificationReason || justificationReason.trim() === "")) {
      throw new Error("Norma ISO 15189: Debe ingresar una justificación técnica obligatoria para desviarse del lote sugerido por FEFO.");
    }

    const { error: consumeError } = await StockService.consumeStock({
      batch_id: batchId,
      quantity,
      consumed_by: user.id,
      reason,
      equipment,
      mark_as_opened: markAsOpened,
      reconstituted,
      fefo_deviation: fefoDeviation,
      justification_reason: justificationReason?.trim() || undefined,
    });

    if (consumeError) {
      console.error("Consume error:", consumeError);
      const errorMsg = encodeURIComponent(
        typeof consumeError === 'object' && consumeError !== null && 'message' in consumeError 
        ? String((consumeError as { message: string }).message) 
        : "Error al registrar consumo"
      );
      redirect(`/dashboard/inventario?view=salidas&error=${errorMsg}`);
    }
  } catch (error) {
    if (error instanceof Error && (error as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw error;
    console.error("Fatal Consume Error:", error);
    const errorMsg = encodeURIComponent(error instanceof Error ? error.message : "Error inesperado");
    redirect(`/dashboard/inventario?view=salidas&error=${errorMsg}`);
  }
  
  revalidatePath("/dashboard/inventario");
  redirect("/dashboard/inventario?view=movimientos");
}

export async function handleTransferAction(formData: FormData) {
  const batchId = formData.get("batch_id") as string;
  const destinationLocationId = formData.get("destination_location_id") as string;
  const quantity = Number(formData.get("quantity"));
  const reason = formData.get("reason") as string;

  try {
    const { user } = await requireRole(["admin", "supervisor", "operator"]);
    if (!batchId || !destinationLocationId || !Number.isSafeInteger(quantity) || quantity <= 0) {
      throw new Error("Lote, ubicación destino o cantidad no válidos");
    }

    const { data: locations, error: locationsError } = await CatalogService.getLocations();
    if (locationsError) throw locationsError;
    const isSedeNorte = locations?.some((location: { id: string; name: string; is_active?: boolean }) =>
      location.id === destinationLocationId &&
      location.is_active !== false &&
      location.name.trim().toLocaleLowerCase() === "sede norte"
    );
    if (!isSedeNorte) throw new Error("El destino del traslado debe ser la ubicación Sede Norte.");

    const { error: transferError } = await StockService.transferStock({
      batch_id: batchId,
      destination_location_id: destinationLocationId,
      quantity,
      transferred_by: user.id,
      reason: reason?.trim() || "Traslado interno de inventario",
    });

    if (transferError) {
      console.error("Transfer error:", transferError);
      const errorMsg = encodeURIComponent(
        typeof transferError === "object" && transferError !== null && "message" in transferError
          ? String((transferError as { message: string }).message)
          : "Error al realizar el traslado"
      );
      redirect(`/dashboard/inventario?view=traslados&error=${errorMsg}`);
    }
  } catch (error) {
    if (error instanceof Error && (error as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw error;
    console.error("Fatal Transfer Error:", error);
    const errorMsg = encodeURIComponent(error instanceof Error ? error.message : "Error inesperado");
    redirect(`/dashboard/inventario?view=traslados&error=${errorMsg}`);
  }

  revalidatePath("/dashboard/inventario");
  redirect("/dashboard/inventario?view=movimientos&success=transfer");
}



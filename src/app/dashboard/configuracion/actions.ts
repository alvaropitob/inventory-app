"use server";

import { CatalogService } from "@/lib/services/catalog";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/supabase/authorization";
import { validateCatalogProduct } from "@/lib/validation/catalog";

export async function handleSectionAction(formData: FormData) {
  await requireRole(["admin"]);
  const name = formData.get("name") as string;
  const desc = formData.get("description") as string;
  const id = formData.get("id") as string;
  
  await CatalogService.upsertSection({ 
    id: id || undefined, 
    name, 
    description: desc,
    category_id: null
  });
  revalidatePath("/dashboard/configuracion");
  if (id) redirect(`/dashboard/configuracion?tab=secciones`);
}

export async function handleSupplierAction(formData: FormData) {
  await requireRole(["admin"]);
  const data = {
    id: (formData.get("id") as string) || undefined,
    name: formData.get("name") as string,
    contact_name: formData.get("contact_name") as string,
    contact_email: formData.get("contact_email") as string,
    tax_id: formData.get("tax_id") as string,
  };
  await CatalogService.upsertSupplier(data);
  revalidatePath("/dashboard/configuracion");
  if (data.id) redirect(`/dashboard/configuracion?tab=proveedores`);
}

export async function handleCategoryAction(formData: FormData) {
  await requireRole(["admin"]);
  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const desc = formData.get("description") as string;
  await CatalogService.upsertCategory({ id: id || undefined, name, description: desc });
  revalidatePath("/dashboard/configuracion");
  if (id) redirect(`/dashboard/configuracion?tab=categorias`);
}

export async function handleLocationAction(formData: FormData) {
  await requireRole(["admin"]);
  const sectionId = String(formData.get("section_id") || "").trim();
  if (!sectionId) throw new Error("Selecciona el área a la que pertenece esta ubicación.");
  const { data: activeSections } = await CatalogService.getSections();
  if (!activeSections?.some(section => section.id === sectionId && section.is_active)) {
    throw new Error("Selecciona un área activa para esta ubicación.");
  }
  const data = {
    id: (formData.get("id") as string) || undefined,
    name: formData.get("name") as string,
    description: formData.get("description") as string,
    section_id: sectionId,
    location_type: formData.get("location_type") as string,
  };
  const { error } = await CatalogService.upsertLocation(data);
  if (error) throw new Error(`No se pudo guardar la ubicación: ${error.message}`);
  revalidatePath("/dashboard/configuracion");
  revalidatePath("/dashboard/recepcion");
  revalidatePath("/dashboard/inventario");
  if (data.id) redirect(`/dashboard/configuracion?tab=ubicaciones`);
}

export async function handleCatalogAction(formData: FormData) {
  await requireRole(["admin", "supervisor"]);
  const id = formData.get("id") as string;
  const sectionId = formData.get("section_id") as string;
  if (!sectionId) throw new Error("Selecciona un área activa para el producto.");
  const { data: activeSections } = await CatalogService.getSections();
  const selectedSection = activeSections?.find(section => section.id === sectionId && section.is_active);
  if (!selectedSection) throw new Error("El área seleccionada no está activa. Elige una de las áreas vigentes.");
  const productType = String(formData.get("product_type") || "");
  const productTypes = ["medicamento", "dispositivo_medico", "reactivo", "insumo"];
  if (!productTypes.includes(productType)) throw new Error("Selecciona un tipo de producto válido.");

  const readText = (field: string) => String(formData.get(field) || "").trim();
  const validationError = validateCatalogProduct(Object.fromEntries([
    "product_type", "internal_code", "technical_name", "purchase_unit", "commercial_presentation",
    "active_ingredient", "dosage_form", "concentration", "sanitary_registration", "brand",
    "shelf_life", "series", "product_description", "risk_classification", "supplier_id",
  ].map(field => [field, readText(field)])));
  if (validationError) throw new Error(validationError);
  const riskClassification = readText("risk_classification");
  const riskClassifications = ["I", "II", "IIA", "IIB", "III", "not_applicable"] as const;
  if (["dispositivo_medico", "reactivo", "insumo"].includes(productType) &&
      !riskClassifications.includes(riskClassification as typeof riskClassifications[number])) {
    throw new Error("Selecciona una clasificación de riesgo válida.");
  }
  if (riskClassification && !riskClassifications.includes(riskClassification as typeof riskClassifications[number])) {
    throw new Error("La clasificación de riesgo no es válida.");
  }
  const minimumStock = Number(formData.get("minimum_stock_threshold")) || 0;
  const rawMaximumStock = String(formData.get("maximum_stock_threshold") ?? "").trim();
  const maximumStock = rawMaximumStock ? Number(rawMaximumStock) : null;
  if (!Number.isSafeInteger(minimumStock) || minimumStock < 0 ||
      (maximumStock !== null && (!Number.isSafeInteger(maximumStock) || maximumStock < minimumStock))) {
    redirect(`/dashboard/configuracion?tab=productos&error=${encodeURIComponent("El stock mínimo debe ser entero no negativo y el máximo debe ser mayor o igual al mínimo.")}`);
  }
  
  const category_id = (selectedSection as { category_id: string | null }).category_id || null;
  
  const data = {
    id: id || undefined,
    internal_code: formData.get("internal_code") as string,
    technical_name: formData.get("technical_name") as string,
    commercial_name: (formData.get("commercial_name") as string) || null,
    supplier_id: readText("supplier_id") && readText("supplier_id") !== "not_applicable" ? readText("supplier_id") : null,
    category_id: category_id,
    section_id: sectionId || null,
    purchase_unit: (formData.get("purchase_unit") as string) || "N/A",
    product_type: productType as "medicamento" | "dispositivo_medico" | "reactivo" | "insumo",
    series: readText("series") || null,
    brand: readText("brand") || null,
    product_description: readText("product_description") || null,
    active_ingredient: readText("active_ingredient") || null,
    dosage_form: readText("dosage_form") || null,
    concentration: readText("concentration") || null,
    commercial_presentation: readText("commercial_presentation") || null,
    sanitary_registration: readText("sanitary_registration") || null,
    risk_classification: (riskClassification || null) as typeof riskClassifications[number] | null,
    shelf_life: readText("shelf_life") || null,
    minimum_stock_threshold: minimumStock,
    maximum_stock_threshold: maximumStock,
    estimated_unit_price: Number(formData.get("estimated_unit_price")) || 0,
  };

  await CatalogService.upsertCatalogItem(data);
  revalidatePath("/dashboard/configuracion");
  if (id) redirect("/dashboard/configuracion?tab=productos");
}

export async function toggleStatus(id: string, currentStatus: boolean, type: 'section' | 'supplier' | 'category' | 'location' | 'product') {
  await requireRole(type === "product" ? ["admin", "supervisor"] : ["admin"]);
  const newStatus = !currentStatus;
  if (type === 'section') await CatalogService.toggleSection(id, newStatus);
  else if (type === 'supplier') await CatalogService.toggleSupplier(id, newStatus);
  else if (type === 'category') await CatalogService.toggleCategory(id, newStatus);
  else if (type === 'location') await CatalogService.toggleLocation(id, newStatus);
  else if (type === 'product') await CatalogService.toggleCatalogItem(id, newStatus);
  
  revalidatePath("/dashboard/configuracion");
}

export async function handleDelete(id: string, type: 'section' | 'supplier' | 'category' | 'location' | 'product') {
  await requireRole(["admin"]);
  if (type === 'section') await CatalogService.deleteSection(id);
  else if (type === 'supplier') await CatalogService.deleteSupplier(id);
  else if (type === 'category') await CatalogService.deleteCategory(id);
  else if (type === 'location') await CatalogService.deleteLocation(id);
  else if (type === 'product') await CatalogService.deleteCatalogItem(id);
  
  revalidatePath("/dashboard/configuracion");
}

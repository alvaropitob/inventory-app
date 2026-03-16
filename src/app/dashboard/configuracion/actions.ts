"use server";

import { CatalogService } from "@/lib/services/catalog";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function handleSectionAction(formData: FormData) {
  const name = formData.get("name") as string;
  const desc = formData.get("description") as string;
  const category_id = formData.get("category_id") as string;
  const id = formData.get("id") as string;
  
  await CatalogService.upsertSection({ 
    id: id || undefined, 
    name, 
    description: desc,
    category_id: category_id || null
  });
  revalidatePath("/dashboard/configuracion");
  if (id) redirect(`/dashboard/configuracion?tab=secciones`);
}

export async function handleSupplierAction(formData: FormData) {
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
  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const desc = formData.get("description") as string;
  await CatalogService.upsertCategory({ id: id || undefined, name, description: desc });
  revalidatePath("/dashboard/configuracion");
  if (id) redirect(`/dashboard/configuracion?tab=categorias`);
}

export async function handleLocationAction(formData: FormData) {
  const data = {
    id: (formData.get("id") as string) || undefined,
    name: formData.get("name") as string,
    description: formData.get("description") as string,
    section_id: formData.get("section_id") as string,
    location_type: formData.get("location_type") as string,
  };
  await CatalogService.upsertLocation(data);
  revalidatePath("/dashboard/configuracion");
  if (data.id) redirect(`/dashboard/configuracion?tab=ubicaciones`);
}

export async function handleCatalogAction(formData: FormData) {
  const id = formData.get("id") as string;
  const sectionId = formData.get("section_id") as string;
  
  let category_id = null;
  if (sectionId) {
    const { data: sections } = await CatalogService.getSections();
    const selectedSection = sections?.find(s => s.id === sectionId);
    category_id = (selectedSection as { category_id: string | null })?.category_id || null;
  }
  
  const data = {
    id: id || undefined,
    internal_code: formData.get("internal_code") as string,
    technical_name: formData.get("technical_name") as string,
    commercial_name: (formData.get("commercial_name") as string) || null,
    category_id: category_id,
    section_id: sectionId || null,
    purchase_unit: (formData.get("purchase_unit") as string) || "N/A",
    minimum_stock_threshold: Number(formData.get("minimum_stock_threshold")) || 0,
    estimated_unit_price: Number(formData.get("estimated_unit_price")) || 0,
  };

  await CatalogService.upsertCatalogItem(data);
  revalidatePath("/dashboard/configuracion");
  if (id) redirect("/dashboard/configuracion?tab=productos");
}

export async function toggleStatus(id: string, currentStatus: boolean, type: 'section' | 'supplier' | 'category' | 'location' | 'product') {
  const newStatus = !currentStatus;
  if (type === 'section') await CatalogService.toggleSection(id, newStatus);
  else if (type === 'supplier') await CatalogService.toggleSupplier(id, newStatus);
  else if (type === 'category') await CatalogService.toggleCategory(id, newStatus);
  else if (type === 'location') await CatalogService.toggleLocation(id, newStatus);
  else if (type === 'product') await CatalogService.toggleCatalogItem(id, newStatus);
  
  revalidatePath("/dashboard/configuracion");
}

export async function handleDelete(id: string, type: 'section' | 'supplier' | 'category' | 'location' | 'product') {
  if (type === 'section') await CatalogService.deleteSection(id);
  else if (type === 'supplier') await CatalogService.deleteSupplier(id);
  else if (type === 'category') await CatalogService.deleteCategory(id);
  else if (type === 'location') await CatalogService.deleteLocation(id);
  else if (type === 'product') await CatalogService.deleteCatalogItem(id);
  
  revalidatePath("/dashboard/configuracion");
}

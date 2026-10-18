"use server";

import { CatalogService } from "@/lib/services/catalog";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function handleSupplierAction(formData: FormData) {
  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const taxId = formData.get("tax_id") as string;
  const contactName = formData.get("contact_name") as string;
  const contactEmail = formData.get("contact_email") as string;
  const contactPhone = formData.get("contact_phone") as string;
  const address = formData.get("address") as string;

  if (!name || name.trim() === "") {
    redirect("/dashboard/proveedores?error=" + encodeURIComponent("El nombre del proveedor es obligatorio"));
  }

  const supplierData = {
    id: id || undefined,
    name: name.trim(),
    tax_id: taxId ? taxId.trim() : null,
    contact_name: contactName ? contactName.trim() : null,
    contact_email: contactEmail ? contactEmail.trim() : null,
    contact_phone: contactPhone ? contactPhone.trim() : null,
    address: address ? address.trim() : null,
    is_active: true,
  };

  const { error } = await CatalogService.upsertSupplier(supplierData);

  if (error) {
    console.error("Error al guardar proveedor:", error);
    redirect("/dashboard/proveedores?error=" + encodeURIComponent("Error al registrar proveedor: " + error.message));
  }

  revalidatePath("/dashboard/proveedores");
  redirect("/dashboard/proveedores?success=1");
}

export async function toggleSupplierStatus(id: string, currentStatus: boolean) {
  await CatalogService.toggleSupplier(id, !currentStatus);
  revalidatePath("/dashboard/proveedores");
}

export async function deleteSupplierAction(id: string) {
  await CatalogService.deleteSupplier(id);
  revalidatePath("/dashboard/proveedores");
}

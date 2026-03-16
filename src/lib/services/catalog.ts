import { createClient } from "@/lib/supabase/server";

export interface MasterItem {
  id: string;
  name: string;
  description?: string | null;
  is_active?: boolean;
  created_at?: string;
}

export interface Supplier extends MasterItem {
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  address?: string | null;
  tax_id?: string | null;
}

export interface Section extends MasterItem {
  category_id: string | null;
}

export interface CatalogItem {
  id: string;
  internal_code: string;
  technical_name: string;
  commercial_name?: string | null;
  category_id?: string | null;
  section_id?: string | null;
  supplier_id?: string | null;
  purchase_unit: string;
  usage_unit?: string | null;
  minimum_stock_threshold?: number;
  estimated_unit_price?: number;
  sanitary_registration?: string | null;
  is_active?: boolean;
  created_at?: string;
  // Relational data
  categories?: { name: string };
  sections?: { name: string };
  suppliers?: { name: string };
}

/**
 * Service for managing master tables and catalog entities.
 */
export const CatalogService = {
  // --- SECTIONS ---
  async getSections() {
    const supabase = await createClient();
    return await supabase.from("sections").select("*, categories(name)").order("name");
  },

  async upsertSection(data: Partial<Section>) {
    const supabase = await createClient();
    return await supabase.from("sections").upsert(data).select().single();
  },

  async toggleSection(id: string, isActive: boolean) {
    const supabase = await createClient();
    return await supabase.from("sections").update({ is_active: isActive }).eq("id", id);
  },

  async deleteSection(id: string) {
    const supabase = await createClient();
    return await supabase.from("sections").delete().eq("id", id);
  },

  // --- SUPPLIERS ---
  async getSuppliers() {
    const supabase = await createClient();
    return await supabase.from("suppliers").select("*").order("name");
  },

  async upsertSupplier(data: Partial<Supplier>) {
    const supabase = await createClient();
    return await supabase.from("suppliers").upsert(data).select().single();
  },

  async toggleSupplier(id: string, isActive: boolean) {
    const supabase = await createClient();
    return await supabase.from("suppliers").update({ is_active: isActive }).eq("id", id);
  },

  async deleteSupplier(id: string) {
    const supabase = await createClient();
    return await supabase.from("suppliers").delete().eq("id", id);
  },

  // --- LOCATIONS ---
  async getLocations() {
    const supabase = await createClient();
    return await supabase.from("locations").select("*, sections(name)").order("name");
  },

  async upsertLocation(data: { id?: string; name: string; section_id: string; location_type: string; is_active?: boolean }) {
    const supabase = await createClient();
    return await supabase.from("locations").upsert(data).select().single();
  },

  // --- CATEGORIES ---
  async getCategories() {
    const supabase = await createClient();
    return await supabase.from("categories").select("*").order("name");
  },

  async upsertCategory(data: Partial<MasterItem>) {
    const supabase = await createClient();
    return await supabase.from("categories").upsert(data).select().single();
  },

  async toggleCategory(id: string, isActive: boolean) {
    const supabase = await createClient();
    return await supabase.from("categories").update({ is_active: isActive }).eq("id", id);
  },

  async deleteCategory(id: string) {
    const supabase = await createClient();
    return await supabase.from("categories").delete().eq("id", id);
  },

  // --- CATALOG ITEMS ---
  async getCatalogItems() {
    const supabase = await createClient();
    return await supabase
      .from("catalog_items")
      .select("*, sections(name), suppliers(name), categories(name)")
      .order("technical_name");
  },

  async upsertCatalogItem(data: Partial<CatalogItem>) {
    const supabase = await createClient();
    return await supabase.from("catalog_items").upsert(data).select().single();
  },

  async deleteCatalogItem(id: string) {
    const supabase = await createClient();
    return supabase.from("catalog_items").delete().eq("id", id);
  },

  async toggleCatalogItem(id: string, isActive: boolean) {
    const supabase = await createClient();
    return await supabase.from("catalog_items").update({ is_active: isActive }).eq("id", id);
  },

  async toggleLocation(id: string, isActive: boolean) {
    const supabase = await createClient();
    return await supabase.from("locations").update({ is_active: isActive }).eq("id", id);
  },

  async deleteLocation(id: string) {
    const supabase = await createClient();
    return await supabase.from("locations").delete().eq("id", id);
  }
};

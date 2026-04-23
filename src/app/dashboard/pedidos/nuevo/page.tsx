import { CatalogService } from "@/lib/services/catalog";
import NewOrderForm from "@/components/NewOrderForm";

export const dynamic = "force-dynamic";

export default async function NewOrderPage() {
  const { data: suppliers } = await CatalogService.getSuppliers();
  const { data: items } = await CatalogService.getCatalogItems();

  const activeSuppliers = suppliers?.filter(s => s.is_active) || [];
  const activeItems = items?.filter(i => i.is_active) || [];

  return (
    <div className="dashboard-main">
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Crear Nuevo Pedido</h1>
          <p className="page-header-subtitle">Selecciona el proveedor y los productos que deseas solicitar.</p>
        </div>
      </div>

      <div className="form-card">
        <NewOrderForm
          suppliers={activeSuppliers.map(s => ({ id: s.id, name: s.name }))}
          items={activeItems.map(i => ({
            id: i.id,
            technical_name: i.technical_name,
            commercial_name: i.commercial_name || "",
            internal_code: i.internal_code,
          }))}
        />
      </div>
    </div>
  );
}

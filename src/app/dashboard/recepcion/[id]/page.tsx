import { OrderService } from "@/lib/services/orders";
import TechnicalReceptionForm from "@/components/TechnicalReceptionForm";
import { notFound } from "next/navigation";
import { CatalogService } from "@/lib/services/catalog";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function TechnicalReceptionDetailPage({ params }: Props) {
  const { id } = await params;

  try {
    const [order, locationsResponse] = await Promise.all([
      OrderService.getOrderById(id),
      CatalogService.getLocations(),
    ]);

    if (!order) {
      notFound();
    }

    const formattedOrder = {
      id: order.id!,
      order_number: order.order_number,
      supplier: { name: order.supplier?.name || "Proveedor Desconocido" },
      items: (order.items || []).map(item => ({
        catalog_item_id: item.item_id,
        catalog_item: {
          internal_code: item.catalog_item?.internal_code || "N/A",
          technical_name: item.catalog_item?.technical_name || "Desconocido",
          commercial_name: item.catalog_item?.commercial_name || "",
          section_id: item.catalog_item?.section_id || null,
        },
        quantity_requested: item.quantity_requested,
        quantity_received: item.quantity_received || 0,
        estimated_unit_price: item.estimated_unit_price || 0,
      })),
    };

    return (
      <div className="dashboard-main">
        <div className="page-header">
          <div>
            <h1 className="page-header-title">Inspección Técnica: {order.order_number}</h1>
            <p className="page-header-subtitle">Verifica el estado físico, temperatura y fechas de vencimiento de los productos.</p>
          </div>
        </div>

        <div className="form-card">
          <TechnicalReceptionForm order={formattedOrder} locations={locationsResponse.data || []} />
        </div>
      </div>
    );
  } catch (err) {
    console.error("Error loading order for reception:", err);
    notFound();
  }
}

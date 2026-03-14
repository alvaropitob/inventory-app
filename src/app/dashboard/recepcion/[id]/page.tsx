import { OrderService } from "@/lib/services/orders";
import TechnicalReceptionForm from "@/components/TechnicalReceptionForm";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function TechnicalReceptionDetailPage({ params }: Props) {
  const { id } = await params;
  
  try {
    const order = await OrderService.getOrderById(id);
    
    if (!order) {
      notFound();
    }

    // Adapt structure for the form if needed (ensure strict types)
    const formattedOrder = {
        id: order.id!,
        order_number: order.order_number,
        supplier: { name: order.supplier?.name || "Proveedor Desconocido" },
        items: (order.items || []).map(item => ({
            catalog_item_id: item.item_id,
            catalog_item: {
                internal_code: item.catalog_item?.internal_code || "N/A",
                technical_name: item.catalog_item?.technical_name || "Desconocido",
                commercial_name: item.catalog_item?.commercial_name || ""
            },
            quantity_requested: item.quantity_requested,
            estimated_unit_price: item.estimated_unit_price || 0
        }))
    };

    return (
      <div className="dashboard-main">
        <div className="welcome-section">
          <h1>Inspección Técnica: {order.order_number}</h1>
          <p>Verifica el estado físico, temperatura y fechas de vencimiento de los productos.</p>
        </div>

        <div className="stat-card" style={{ width: '100%', flexDirection: 'column', alignItems: 'stretch' }}>
          <TechnicalReceptionForm order={formattedOrder} />
        </div>
      </div>
    );
  } catch (err) {
    console.error("Error loading order for reception:", err);
    notFound();
  }
}

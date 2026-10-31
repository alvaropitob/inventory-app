import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import RealtimeStockTable from "@/app/dashboard/inventario/RealtimeStockTable";
import ProductMaintenanceList from "@/components/ProductMaintenanceList";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnValue({ id: "mock-channel" }),
    })),
    removeChannel: vi.fn(),
  })),
}));

const mockProduct = {
  id: "prod-10627",
  internal_code: "10627",
  technical_name: "APOLIPOPROTEINA B",
  commercial_name: "APOLIPOPROTEINA B KIT",
  section_id: "sec-quimica",
  supplier_id: "sup-ihr",
  product_type: "reactivo",
  brand: "MINDRAY",
  product_description: "NA",
  series: "NA",
  active_ingredient: "NA",
  dosage_form: "NA",
  concentration: "NA",
  commercial_presentation: "R1:1*35 ML+R2:1*12 ML",
  purchase_unit: "1",
  sanitary_registration: "2021RD-0002084-R1",
  risk_classification: "not_applicable",
  shelf_life: "16/12/2027",
  minimum_stock_threshold: 1,
  maximum_stock_threshold: 10,
  estimated_unit_price: 235800,
  is_active: true,
  sections: { name: "QUIMICA" },
};

const mockSuppliers = [
  { id: "sup-ihr", name: "Especialidades Diagnosticas IHR" },
];

const mockBatches = [
  {
    id: "batch-1",
    item_id: "prod-10627",
    batch_number: "LOT-2026-099",
    expiration_date: "2027-12-16T00:00:00+00:00",
    current_stock: 4,
    initial_quantity: 5,
    opened_units_remaining: 0,
    supplier_id: "sup-ihr",
    location_id: "loc-1",
    status: "active",
    clinical_status: "accepted",
    item: {
      technical_name: "APOLIPOPROTEINA B",
      commercial_name: "APOLIPOPROTEINA B KIT",
      internal_code: "10627",
      commercial_presentation: "R1:1*35 ML+R2:1*12 ML",
      minimum_stock_threshold: 1,
      maximum_stock_threshold: 10,
      section_id: "sec-quimica",
      sections: { name: "QUIMICA" },
    },
    location: { name: "Nevera Química 1", section_id: "sec-quimica" },
  },
];

const mockMovements = [
  {
    id: "mov-1",
    movement_type: "entry",
    created_at: "2026-10-30T14:00:00Z",
    quantity: 5,
    reason: "Recepción inicial",
    batch: {
      item_id: "prod-10627",
      batch_number: "LOT-2026-099",
      expiration_date: "2027-12-16",
    },
    users: { full_name: "Liliana A Pito B", username: "liliana" },
  },
];

describe("UI Ficha de Producto (Inventario -> Stock y Configuración -> Productos)", () => {
  it("abre la ficha completa con doble clic sobre la fila en Inventario -> Stock y muestra lotes y etiquetas legibles", () => {
    render(
      <RealtimeStockTable
        initialBatches={mockBatches}
        sections={[{ id: "sec-quimica", name: "QUIMICA" }]}
        catalogItems={[mockProduct]}
        suppliers={mockSuppliers}
        movements={mockMovements}
      />
    );

    const productCell = screen.getByText("APOLIPOPROTEINA B");
    const row = productCell.closest("tr");
    expect(row).not.toBeNull();

    // Simular doble clic sobre la fila del producto
    fireEvent.doubleClick(row!);

    const dialog = screen.getByRole("dialog", { name: "APOLIPOPROTEINA B" });
    expect(dialog).toBeInTheDocument();

    // Verificar etiquetas formateadas y datos maestros
    expect(within(dialog).getByText("Reactivo")).toBeInTheDocument();
    expect(within(dialog).getByText("No aplica")).toBeInTheDocument();
    expect(within(dialog).getByText("2021RD-0002084-R1")).toBeInTheDocument();
    expect(within(dialog).getAllByText("Especialidades Diagnosticas IHR").length).toBeGreaterThanOrEqual(1);

    // Verificar lote y movimientos dentro del modal
    expect(within(dialog).getAllByText("LOT-2026-099").length).toBeGreaterThanOrEqual(1);
    expect(within(dialog).queryByText("Invalid Date")).not.toBeInTheDocument();
    expect(within(dialog).getByText("Nevera Química 1")).toBeInTheDocument();
    expect(within(dialog).getByText("Recepción inicial")).toBeInTheDocument();

    // Cerrar con Escape
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("abre la ficha completa con doble clic o botón 'Ver ficha' en Configuración -> Productos", () => {
    render(
      <ProductMaintenanceList
        initialItems={[mockProduct]}
        batches={mockBatches}
        suppliers={mockSuppliers}
        toggleStatusAction={vi.fn()}
        handleDeleteAction={vi.fn()}
      />
    );

    const productCell = screen.getByText("APOLIPOPROTEINA B");
    const row = productCell.closest("tr");
    expect(row).not.toBeNull();

    // Doble clic en la fila en Configuración -> Productos
    fireEvent.doubleClick(row!);

    const dialog = screen.getByRole("dialog", { name: "APOLIPOPROTEINA B" });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("Reactivo")).toBeInTheDocument();
    expect(within(dialog).getByText("LOT-2026-099")).toBeInTheDocument();
    expect(within(dialog).getByText("Nevera Química 1")).toBeInTheDocument();

    // Cerrar modal con el botón ×
    fireEvent.click(within(dialog).getByRole("button", { name: "Cerrar ficha" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Abrir nuevamente con el botón "Ver ficha"
    fireEvent.click(screen.getByRole("button", { name: /Ver ficha completa de APOLIPOPROTEINA B/i }));
    expect(screen.getByRole("dialog", { name: "APOLIPOPROTEINA B" })).toBeInTheDocument();
  });
});


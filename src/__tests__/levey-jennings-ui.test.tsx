import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import MonitoreoPage from "@/app/dashboard/monitoreo/page";
import { getCurrentUserProfile } from "@/lib/services/user";
import { CatalogService } from "@/lib/services/catalog";
import { ComplianceService } from "@/lib/services/compliance";

vi.mock("@/lib/services/user", () => ({
  getCurrentUserProfile: vi.fn(),
}));

vi.mock("@/lib/services/catalog", () => ({
  CatalogService: {
    getLocations: vi.fn(),
  },
}));

vi.mock("@/lib/services/compliance", () => ({
  ComplianceService: {
    getEnvironmentalLogs: vi.fn(),
  },
}));

describe("MonitoreoPage - Gráfica Levey-Jennings UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getCurrentUserProfile as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      id: "admin-1",
      role: "admin",
      full_name: "Admin User",
    });
  });

  it("renders Levey-Jennings chart with all 7 control lines and data points for configured location", async () => {
    const mockLocations = [
      {
        id: "loc-nevera-1",
        name: "Nevera Reactivos",
        location_type: "refrigerated",
        temperature_min: 2,
        temperature_max: 8,
        is_active: true,
      },
    ];

    const mockLogs = [
      {
        id: "log-1",
        location_id: "loc-nevera-1",
        temperature: 4.5,
        reading_type: "am",
        created_at: "2026-11-01T08:00:00Z",
        locations: { name: "Nevera Reactivos", temperature_min: 2, temperature_max: 8 },
        temperature_min_at_reading: 2,
        temperature_max_at_reading: 8,
        is_out_of_range: false,
      },
      {
        id: "log-2",
        location_id: "loc-nevera-1",
        temperature: 5.2,
        reading_type: "pm",
        created_at: "2026-11-01T16:00:00Z",
        locations: { name: "Nevera Reactivos", temperature_min: 2, temperature_max: 8 },
        temperature_min_at_reading: 2,
        temperature_max_at_reading: 8,
        is_out_of_range: false,
      },
      {
        id: "log-3",
        location_id: "loc-nevera-1",
        temperature: 8.5, // Fuera de rango (> 8 °C)
        reading_type: "am",
        created_at: "2026-11-02T08:00:00Z",
        locations: { name: "Nevera Reactivos", temperature_min: 2, temperature_max: 8 },
        temperature_min_at_reading: 2,
        temperature_max_at_reading: 8,
        is_out_of_range: true,
      },
    ];

    (CatalogService.getLocations as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      data: mockLocations,
    });
    (ComplianceService.getEnvironmentalLogs as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue(
      [mockLogs[2], mockLogs[1], mockLogs[0]] // DB returns DESC (newest first)
    );

    const PageComponent = await MonitoreoPage({
      searchParams: Promise.resolve({ location: "loc-nevera-1" }),
    });

    render(PageComponent);

    // Encabezado y resumen del rango Levey-Jennings
    expect(screen.getByText(/Gráfica Levey–Jennings/i)).toBeInTheDocument();
    expect(screen.getByText(/Rango configurado:/i)).toBeInTheDocument();
    expect(screen.getByText(/Media del rango:/i)).toBeInTheDocument();
    expect(screen.getByText(/DE estimada:/i)).toBeInTheDocument();

    // Valores exactos: Media = 5.00 °C, DE = 1.00 °C
    expect(screen.getByText("5.00 °C")).toBeInTheDocument();
    expect(screen.getByText("1.00 °C")).toBeInTheDocument();

    // SVG de la gráfica
    const svg = screen.getByRole("img", { name: /Gráfica Levey-Jennings de temperatura para Nevera Reactivos/i });
    expect(svg).toBeInTheDocument();

    // Las 7 líneas de referencia de Levey-Jennings
    expect(screen.getByText(/Media · 5.00/i)).toBeInTheDocument();
    expect(screen.getByText(/\+3 DE · 8.00/i)).toBeInTheDocument();
    expect(screen.getByText(/\+2 DE · 7.00/i)).toBeInTheDocument();
    expect(screen.getByText(/\+1 DE · 6.00/i)).toBeInTheDocument();
    expect(screen.getByText(/−1 DE · 4.00/i)).toBeInTheDocument();
    expect(screen.getByText(/−2 DE · 3.00/i)).toBeInTheDocument();
    expect(screen.getByText(/−3 DE · 2.00/i)).toBeInTheDocument();

    // Puntos graficados y colores clínicos
    const circles = svg.querySelectorAll("circle");
    expect(circles.length).toBe(3);

    // Punto 1: AM dentro de rango -> color teal (#0f766e)
    expect(circles[0].getAttribute("fill")).toBe("#0f766e");

    // Punto 2: PM dentro de rango -> color azul (#2563eb)
    expect(circles[1].getAttribute("fill")).toBe("#2563eb");

    // Punto 3: Fuera de rango (8.5 °C) -> color rojo (#dc2626)
    expect(circles[2].getAttribute("fill")).toBe("#dc2626");

    // Línea conectora polyline
    const polyline = svg.querySelector("polyline");
    expect(polyline).not.toBeNull();
    expect(polyline?.getAttribute("stroke")).toBe("#2563eb");
  });

  it("informs user when a location has no temperature range configured", async () => {
    const mockLocations = [
      {
        id: "loc-sin-rango",
        name: "Ubicación Sin Rango",
        location_type: "room_temp",
        temperature_min: null,
        temperature_max: null,
        is_active: true,
      },
    ];

    (CatalogService.getLocations as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      data: mockLocations,
    });
    (ComplianceService.getEnvironmentalLogs as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue([
      {
        id: "log-1",
        temperature: 22,
        created_at: "2026-11-01T08:00:00Z",
      },
    ]);

    const PageComponent = await MonitoreoPage({
      searchParams: Promise.resolve({ location: "loc-sin-rango" }),
    });

    render(PageComponent);

    expect(screen.getByText(/Configura la temperatura mínima y máxima de esta ubicación/i)).toBeInTheDocument();
  });
});

import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUserProfile } from "@/lib/services/user";
import { CatalogService } from "@/lib/services/catalog";
import * as Actions from "./actions";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    editId?: string;
    search?: string;
    error?: string;
    success?: string;
  }>;
}

export default async function ProveedoresPage({ searchParams }: PageProps) {
  const user = await getCurrentUserProfile();
  if (!user) {
    redirect("/auth/login");
  }

  const { editId, search, error, success } = await searchParams;
  const { data: rawSuppliers } = await CatalogService.getSuppliers();
  const suppliers = rawSuppliers || [];

  const editingSupplier = editId ? suppliers.find((s) => s.id === editId) : null;

  const filteredSuppliers = suppliers.filter((s) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(term) ||
      (s.tax_id && s.tax_id.toLowerCase().includes(term)) ||
      (s.contact_name && s.contact_name.toLowerCase().includes(term)) ||
      (s.contact_email && s.contact_email.toLowerCase().includes(term))
    );
  });

  const activeCount = suppliers.filter((s) => s.is_active).length;
  const inactiveCount = suppliers.length - activeCount;

  return (
    <div className="dashboard-main" style={{ padding: "1.5rem 2rem", maxWidth: "1600px", margin: "0 auto" }}>
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.75rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--navy)", marginBottom: "0.25rem" }}>
            Directorio de Proveedores
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.925rem" }}>
            Gestión y homologación de aliados comerciales y distribuidores de reactivos clínicos.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <Link
            href="/dashboard/proveedores/evaluacion"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.6rem 1.25rem",
              borderRadius: "var(--radius)",
              backgroundColor: "var(--white)",
              color: "var(--primary-dark)",
              border: "1px solid var(--border)",
              fontWeight: 600,
              fontSize: "0.875rem",
              textDecoration: "none",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            ⭐ Ver Evaluaciones
          </Link>
          <a
            href="#formulario-proveedor"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.6rem 1.25rem",
              borderRadius: "var(--radius)",
              backgroundColor: "var(--primary)",
              color: "#ffffff",
              fontWeight: 600,
              fontSize: "0.875rem",
              textDecoration: "none",
              boxShadow: "var(--shadow-md)",
            }}
          >
            + Nuevo Proveedor
          </a>
        </div>
      </div>

      {/* FEEDBACK BANNERS */}
      {error && (
        <div
          style={{
            padding: "1rem 1.25rem",
            borderRadius: "var(--radius)",
            backgroundColor: "#fee2e2",
            border: "1px solid #fca5a5",
            color: "#991b1b",
            marginBottom: "1.5rem",
            fontSize: "0.9rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          ⚠️ {decodeURIComponent(error)}
        </div>
      )}
      {success && (
        <div
          style={{
            padding: "1rem 1.25rem",
            borderRadius: "var(--radius)",
            backgroundColor: "#d1fae5",
            border: "1px solid #86efac",
            color: "#065f46",
            marginBottom: "1.5rem",
            fontSize: "0.9rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          ✅ Operación realizada exitosamente.
        </div>
      )}

      {/* KPIS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.25rem", marginBottom: "2rem" }}>
        <div style={{ backgroundColor: "var(--white)", padding: "1.25rem", borderRadius: "var(--radius)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
          <p style={{ fontSize: "0.825rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Total Proveedores</p>
          <p style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--navy)", marginTop: "0.35rem" }}>{suppliers.length}</p>
        </div>
        <div style={{ backgroundColor: "var(--white)", padding: "1.25rem", borderRadius: "var(--radius)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
          <p style={{ fontSize: "0.825rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Activos / Calificados</p>
          <p style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--success)", marginTop: "0.35rem" }}>{activeCount}</p>
        </div>
        <div style={{ backgroundColor: "var(--white)", padding: "1.25rem", borderRadius: "var(--radius)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
          <p style={{ fontSize: "0.825rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Inactivos</p>
          <p style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text-subtle)", marginTop: "0.35rem" }}>{inactiveCount}</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "2rem", alignItems: "start" }}>
        {/* LISTADO Y BÚSQUEDA */}
        <div style={{ backgroundColor: "var(--white)", borderRadius: "var(--radius)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)", overflow: "hidden" }}>
          <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--navy)" }}>
              Lista de Proveedores Registrados ({filteredSuppliers.length})
            </h2>
            <form method="get" style={{ display: "flex", gap: "0.5rem" }}>
              <input
                type="text"
                name="search"
                defaultValue={search || ""}
                placeholder="Buscar por nombre, NIT..."
                style={{
                  padding: "0.5rem 0.85rem",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  fontSize: "0.875rem",
                  width: "240px",
                }}
              />
              <button
                type="submit"
                style={{
                  padding: "0.5rem 0.9rem",
                  borderRadius: "8px",
                  backgroundColor: "var(--navy)",
                  color: "#fff",
                  fontSize: "0.875rem",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Buscar
              </button>
            </form>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
              <thead>
                <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid var(--border)", color: "var(--text-muted)", textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: "0.05em" }}>
                  <th style={{ padding: "0.85rem 1.25rem" }}>Razón Social / Proveedor</th>
                  <th style={{ padding: "0.85rem 1.25rem" }}>NIT / RUT</th>
                  <th style={{ padding: "0.85rem 1.25rem" }}>Contacto</th>
                  <th style={{ padding: "0.85rem 1.25rem" }}>Teléfono</th>
                  <th style={{ padding: "0.85rem 1.25rem", textAlign: "center" }}>Estado</th>
                  <th style={{ padding: "0.85rem 1.25rem", textAlign: "right" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredSuppliers.map((s) => (
                  <tr key={s.id} style={{ borderBottom: "1px solid var(--border)", transition: "background 0.15s" }}>
                    <td style={{ padding: "1rem 1.25rem", fontWeight: 600, color: "var(--navy)" }}>
                      <div>{s.name}</div>
                      {s.address && (
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 400, marginTop: "2px" }}>
                          📍 {s.address}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "1rem 1.25rem", color: "var(--text-main)", fontFamily: "monospace" }}>
                      {s.tax_id || "—"}
                    </td>
                    <td style={{ padding: "1rem 1.25rem", color: "var(--text-main)" }}>
                      <div>{s.contact_name || "—"}</div>
                      {s.contact_email && (
                        <div style={{ fontSize: "0.75rem", color: "var(--primary-dark)" }}>
                          ✉️ {s.contact_email}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "1rem 1.25rem", color: "var(--text-main)" }}>
                      {s.contact_phone || "—"}
                    </td>
                    <td style={{ padding: "1rem 1.25rem", textAlign: "center" }}>
                      <span
                        style={{
                          padding: "0.25rem 0.65rem",
                          borderRadius: "999px",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          backgroundColor: s.is_active ? "#dcfce7" : "#f1f5f9",
                          color: s.is_active ? "#15803d" : "#64748b",
                        }}
                      >
                        {s.is_active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td style={{ padding: "1rem 1.25rem", textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "0.5rem" }}>
                        <Link
                          href={`/dashboard/proveedores?editId=${s.id}#formulario-proveedor`}
                          style={{
                            padding: "0.35rem 0.65rem",
                            borderRadius: "6px",
                            backgroundColor: "var(--primary-light)",
                            color: "var(--primary-dark)",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            textDecoration: "none",
                          }}
                        >
                          Editar
                        </Link>
                        <form
                          action={async () => {
                            "use server";
                            await Actions.toggleSupplierStatus(s.id, !!s.is_active);
                          }}
                          style={{ display: "inline" }}
                        >
                          <button
                            type="submit"
                            style={{
                              padding: "0.35rem 0.65rem",
                              borderRadius: "6px",
                              backgroundColor: "#f8fafc",
                              border: "1px solid var(--border)",
                              color: "var(--text-muted)",
                              fontSize: "0.75rem",
                              cursor: "pointer",
                            }}
                          >
                            {s.is_active ? "Desactivar" : "Activar"}
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredSuppliers.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>
                      No se encontraron proveedores que coincidan con la búsqueda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* FORMULARIO LATERAL (CREAR / EDITAR) */}
        <div
          id="formulario-proveedor"
          style={{
            backgroundColor: "var(--white)",
            borderRadius: "var(--radius)",
            border: "1px solid var(--border)",
            padding: "1.5rem",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.75rem" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--navy)" }}>
              {editingSupplier ? "Editar Proveedor" : "Registrar Proveedor"}
            </h3>
            {editingSupplier && (
              <Link href="/dashboard/proveedores" style={{ fontSize: "0.8rem", color: "var(--text-muted)", textDecoration: "underline" }}>
                Cancelar
              </Link>
            )}
          </div>

          <form action={Actions.handleSupplierAction} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {editingSupplier && <input type="hidden" name="id" value={editingSupplier.id} />}

            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--navy)", marginBottom: "0.35rem" }}>
                Razón Social / Nombre Comercial *
              </label>
              <input
                type="text"
                name="name"
                required
                defaultValue={editingSupplier?.name || ""}
                placeholder="Ej: Abbott Laboratories, Roche..."
                style={{
                  width: "100%",
                  padding: "0.6rem 0.85rem",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  fontSize: "0.875rem",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--navy)", marginBottom: "0.35rem" }}>
                NIT / Identificación Fiscal
              </label>
              <input
                type="text"
                name="tax_id"
                defaultValue={editingSupplier?.tax_id || ""}
                placeholder="Ej: 900.123.456-7"
                style={{
                  width: "100%",
                  padding: "0.6rem 0.85rem",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  fontSize: "0.875rem",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--navy)", marginBottom: "0.35rem" }}>
                Persona de Contacto
              </label>
              <input
                type="text"
                name="contact_name"
                defaultValue={editingSupplier?.contact_name || ""}
                placeholder="Ej: Dr. Carlos Pérez"
                style={{
                  width: "100%",
                  padding: "0.6rem 0.85rem",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  fontSize: "0.875rem",
                }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--navy)", marginBottom: "0.35rem" }}>
                  Teléfono
                </label>
                <input
                  type="text"
                  name="contact_phone"
                  defaultValue={editingSupplier?.contact_phone || ""}
                  placeholder="Ej: 310 123 4567"
                  style={{
                    width: "100%",
                    padding: "0.6rem 0.85rem",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    fontSize: "0.875rem",
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--navy)", marginBottom: "0.35rem" }}>
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  name="contact_email"
                  defaultValue={editingSupplier?.contact_email || ""}
                  placeholder="ventas@proveedor.com"
                  style={{
                    width: "100%",
                    padding: "0.6rem 0.85rem",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    fontSize: "0.875rem",
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--navy)", marginBottom: "0.35rem" }}>
                Dirección Física
              </label>
              <input
                type="text"
                name="address"
                defaultValue={editingSupplier?.address || ""}
                placeholder="Calle / Carrera / Ciudad"
                style={{
                  width: "100%",
                  padding: "0.6rem 0.85rem",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  fontSize: "0.875rem",
                }}
              />
            </div>

            <button
              type="submit"
              style={{
                marginTop: "0.5rem",
                padding: "0.75rem",
                borderRadius: "8px",
                backgroundColor: "var(--primary)",
                color: "#ffffff",
                border: "none",
                fontWeight: 700,
                fontSize: "0.9rem",
                cursor: "pointer",
                boxShadow: "var(--shadow-md)",
              }}
            >
              {editingSupplier ? "Actualizar Proveedor" : "Guardar Proveedor"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

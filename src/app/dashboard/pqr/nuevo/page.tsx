import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/services/user";
import { hasPermission } from "@/lib/permissions";
import { PQR_MODULES, PQR_PRIORITIES, PQR_TYPES } from "@/lib/pqr";
import { createPqr } from "../actions";

export const dynamic = "force-dynamic";

export default async function NuevaPqrPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await getCurrentUserProfile();
  if (!user) redirect("/auth/login");
  if (!hasPermission(user.permissions, "pqr.submit")) redirect("/dashboard/pqr");
  const { error } = await searchParams;

  return (
    <div className="dashboard-main">
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Nueva solicitud</h1>
          <p className="page-header-subtitle">Cuéntanos qué ocurrió. Recibirás el seguimiento y la fecha de solución en esta misma sección.</p>
        </div>
        <Link className="btn-secondary" href="/dashboard/pqr">Volver</Link>
      </div>

      {error && <p className="alert-error" role="alert">{error}</p>}

      <form action={createPqr} className="form-card">
        <div className="form-card-header"><h2 className="form-card-title">Datos de la solicitud</h2></div>
        <div className="form-card-body" style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          <label className="form-label">Tipo
            <select className="form-select" name="ticket_type" defaultValue="anomalia" required>
              {PQR_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label className="form-label">Módulo afectado
            <select className="form-select" name="module" defaultValue="Otro">
              {PQR_MODULES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="form-label">Prioridad
            <select className="form-select" name="priority" defaultValue="medium" required>
              {PQR_PRIORITIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label className="form-label" style={{ gridColumn: "1 / -1" }}>Asunto
            <input className="form-input" name="title" required minLength={5} maxLength={160} placeholder="Resumen corto del problema" />
          </label>
          <label className="form-label" style={{ gridColumn: "1 / -1" }}>Descripción
            <textarea className="form-textarea" name="description" required minLength={10} maxLength={4000} rows={7} placeholder="¿Qué estabas haciendo? ¿Qué esperabas que pasara y qué pasó? Incluye mensajes de error, lotes, equipos o pedidos involucrados." />
          </label>
          <label className="form-label" style={{ gridColumn: "1 / -1" }}>Página o enlace donde ocurrió (opcional)
            <input className="form-input" name="context_url" maxLength={500} placeholder="Ej: /dashboard/inventario?view=stock" />
          </label>
          <p className="form-hint" style={{ gridColumn: "1 / -1" }}>No incluyas contraseñas ni datos personales de pacientes.</p>
        </div>
        <div className="form-card-body" style={{ display: "flex", gap: ".75rem", justifyContent: "flex-end" }}>
          <Link className="btn-secondary" href="/dashboard/pqr">Cancelar</Link>
          <button className="btn-primary" type="submit">Enviar solicitud</button>
        </div>
      </form>
    </div>
  );
}


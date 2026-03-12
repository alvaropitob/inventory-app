import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    redirect("/login");
  }

  const user = data.user;
  const fullName = user.user_metadata?.full_name || user.user_metadata?.name || "Usuario";
  const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture || null;
  const email = user.email || "";

  return (
    <div className="dashboard-main">
      <div className="welcome-section">
        <div className="welcome-user-info">
          {avatarUrl ? (
            <img src={avatarUrl} alt={fullName} className="welcome-avatar" referrerPolicy="no-referrer" />
          ) : (
            <div className="welcome-avatar-fallback">
              {fullName.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h1>¡Bienvenido, {fullName}!</h1>
            <p>{email}</p>
          </div>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon stat-icon-blue">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            </svg>
          </div>
          <div className="stat-info">
            <h3>0</h3>
            <p>Productos Totales</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon stat-icon-green">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <div className="stat-info">
            <h3>0</h3>
            <p>Pedidos Activos</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon stat-icon-orange">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div className="stat-info">
            <h3>0</h3>
            <p>Proveedores</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon stat-icon-purple">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="1" y="3" width="15" height="13" />
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
          </div>
          <div className="stat-info">
            <h3>0</h3>
            <p>Envíos</p>
          </div>
        </div>
      </div>

      <div className="empty-state">
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
          <rect x="8" y="16" width="48" height="36" rx="4" />
          <path d="M8 28h48" />
          <circle cx="32" cy="40" r="6" />
          <path d="M29 40l2 2 4-4" />
        </svg>
        <h2>Comienza Aquí</h2>
        <p>Tu inventario está vacío. Empieza a agregar productos y proveedores para gestionar tu stock.</p>
      </div>
    </div>
  );
}

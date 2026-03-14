"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";

interface SidebarProps {
  user: {
    fullName: string;
    email: string;
    avatarUrl: string | null;
    role: string;
  };
  isMobileOpen?: boolean;
  onClose?: () => void;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  show: boolean;
  subItems?: { name: string; href: string }[];
}

export function SidebarContent({ user, isMobileOpen, onClose }: SidebarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fullPath = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : "");

  const isAdmin = user.role === "admin";

  const navItems = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
      show: true,
    },
    {
      name: "Usuarios",
      href: "/dashboard/usuarios",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
      show: isAdmin,
    },
    {
      name: "Inventario",
      href: "/dashboard/inventario",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m7.5 4.27 9 5.15" />
          <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
          <path d="m3.3 7 8.7 5 8.7-5" />
          <path d="M12 22V12" />
        </svg>
      ),
      show: true,
      subItems: [
        { name: "Entrada de productos", href: "/dashboard/inventario?view=entradas" },
        { name: "Salida de productos", href: "/dashboard/inventario?view=salidas" },
        { name: "Stock Actual", href: "/dashboard/inventario?view=stock" },
      ]
    },
    {
      name: "Configuración",
      href: "/dashboard/configuracion",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      ),
      show: isAdmin,
    },
    {
      name: "Auditoría",
      href: "/dashboard/auditoria",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2v20" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      ),
      show: isAdmin,
    },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="sidebar-overlay"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      
      <aside className={`sidebar ${isExpanded ? "sidebar-expanded" : ""} ${isMobileOpen ? "sidebar-mobile-open" : ""}`}>
        <div className="sidebar-header">
          <button 
            className="sidebar-toggle desktop-only"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-label={isExpanded ? "Contraer menú" : "Expandir menú"}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              {isExpanded ? (
                <path d="m15 18-6-6 6-6" />
              ) : (
                <path d="m9 18 6-6-6-6" />
              )}
            </svg>
          </button>
          
          {/* Mobile Close Button */}
          <button 
            className="sidebar-toggle mobile-only"
            onClick={onClose}
            aria-label="Cerrar menú"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
          
          <span className="sidebar-logo-text">Portal Clínico</span>
        </div>

        <nav className="sidebar-nav">
          {navItems.filter(item => item.show).map((item) => {
            const isActive = pathname === item.href;
            const hasSubItems = item.subItems && item.subItems.length > 0;
            
            return (
              <div key={item.href}>
                <Link
                  href={item.href}
                  className={`nav-item ${isActive ? "active" : ""}`}
                  onClick={() => {
                    if (typeof window !== 'undefined' && window.innerWidth <= 768 && onClose) onClose();
                  }}
                >
                  <div className="nav-icon">{item.icon}</div>
                  <span className="nav-text">{item.name}</span>
                </Link>
                
                {hasSubItems && (isExpanded || isMobileOpen) && (
                  <div className="sub-nav">
                    {item.subItems?.map(sub => (
                      <Link 
                        key={sub.href} 
                        href={sub.href} 
                        className={`sub-nav-item ${fullPath === sub.href ? "active-sub" : ""}`}
                      >
                        <div className="sub-nav-dot" />
                        <span className="nav-text">{sub.name}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="user-profile-mini">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.fullName} className="avatar-img" />
            ) : (
              <div className="avatar">
                {user.fullName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="user-info-text">
              <span className="name">{user.fullName}</span>
              <span className="email">{user.role.charAt(0).toUpperCase() + user.role.slice(1)}</span>
            </div>
          </div>
          
          <form action="/auth/signout" method="post">
            <button type="submit" className="nav-item signout-nav-item">
              <div className="nav-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </div>
              <span className="nav-text">Cerrar Sesión</span>
            </button>
          </form>
        </div>
      </aside>
      <style jsx>{`
        .sub-nav {
          padding-left: 2rem;
          margin-top: 0.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        .sidebar:not(.sidebar-expanded):not(.sidebar-mobile-open) .sub-nav {
          display: none;
        }
        .sub-nav-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.5rem 1rem;
          color: var(--navy-light);
          text-decoration: none;
          font-size: 0.8125rem;
          border-radius: 6px;
          transition: all 0.2s;
        }
        .sub-nav-item:hover {
          background: var(--bg-app);
          color: var(--primary);
        }
        .sub-nav-dot {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: currentColor;
          opacity: 0.5;
        }
        .nav-item.active + .sub-nav {
          display: flex;
        }
      `}</style>
    </>
  );
}

export default function Sidebar(props: SidebarProps) {
  return (
    <Suspense fallback={<div className="sidebar" />}>
      <SidebarContent {...props} />
    </Suspense>
  );
}

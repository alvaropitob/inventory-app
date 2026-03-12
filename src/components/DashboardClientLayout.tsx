"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";

interface DashboardClientLayoutProps {
  children: React.ReactNode;
  user: {
    fullName: string;
    email: string;
    avatarUrl: string | null;
    role: string;
  };
}

export default function DashboardClientLayout({ children, user }: DashboardClientLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="dashboard-layout">
      {/* Mobile Header */}
      <header className="mobile-header">
        <button 
          className="mobile-menu-toggle"
          onClick={() => setIsMobileMenuOpen(true)}
          aria-label="Abrir menú"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <span className="mobile-logo-text">Portal Clínico</span>
      </header>

      <Sidebar 
        user={user} 
        isMobileOpen={isMobileMenuOpen} 
        onClose={() => setIsMobileMenuOpen(false)} 
      />
      
      <main className="dashboard-content">
        {children}
      </main>
    </div>
  );
}

"use client";

import { useState } from "react";

interface ExportButtonProps {
  data: Record<string, string | number | null>[];
  filename: string;
  label?: string;
}

export default function ExportCSVButton({ data, filename, label = "Exportar a CSV" }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = () => {
    setIsExporting(true);
    try {
      if (!data || data.length === 0) return;

      const headers = Object.keys(data[0]);
      const csvHeaders = headers.map(header => `"${header.replace(/"/g, '""')}"`).join(",");
      
      const rows = data.map(row => {
        return headers.map(header => {
          const value = row[header] ?? "";
          return `"${String(value).replace(/"/g, '""')}"`;
        }).join(",");
      });

      const csvContent = [csvHeaders, ...rows].join("\n");
      // Add BOM for Excel UTF-8 compatibility
      const blob = new Blob(["\ufeff", csvContent], { type: "text/csv;charset=utf-8;" });
      
      // 2. Create download link and trigger
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting CSV:", error);
      alert("Ocurrió un error al exportar los datos.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={isExporting || !data || data.length === 0}
      style={{
        padding: '0.5rem 1rem',
        background: 'white',
        color: 'var(--navy)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        fontWeight: '600',
        fontSize: '0.875rem',
        cursor: (isExporting || !data || data.length === 0) ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        opacity: (isExporting || !data || data.length === 0) ? 0.6 : 1,
        transition: 'all 0.2s',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" x2="12" y1="15" y2="3" />
      </svg>
      {isExporting ? "Exportando..." : label}
    </button>
  );
}

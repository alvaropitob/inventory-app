"use client";

interface PrintReportButtonProps {
  label?: string;
  reportTitle?: string;
}

export default function PrintReportButton({ label = "Imprimir / Guardar PDF", reportTitle }: PrintReportButtonProps) {
  const handlePrint = () => {
    if (reportTitle) {
      const prevTitle = document.title;
      document.title = `${reportTitle}_${new Date().toISOString().split("T")[0]}`;
      window.print();
      document.title = prevTitle;
    } else {
      window.print();
    }
  };

  return (
    <button
      onClick={handlePrint}
      type="button"
      style={{
        padding: "0.5rem 1rem",
        background: "var(--navy)",
        color: "#ffffff",
        border: "none",
        borderRadius: "8px",
        fontWeight: 600,
        fontSize: "0.875rem",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: "0.5rem",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 9 6 2 18 2 18 9" />
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
        <rect x="6" y="14" width="12" height="8" />
      </svg>
      {label}
    </button>
  );
}

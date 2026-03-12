"use client";

import React from 'react';

interface DeleteMasterButtonProps {
  onDelete: () => Promise<void>;
  label?: string;
  confirmMessage?: string;
}

export default function DeleteMasterButton({ 
  onDelete, 
  label = "Eliminar", 
  confirmMessage = "¿Estás seguro de que deseas eliminar este elemento?" 
}: DeleteMasterButtonProps) {
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleClick = async () => {
    if (window.confirm(confirmMessage)) {
      setIsDeleting(true);
      try {
        await onDelete();
      } catch (error) {
        console.error("Error deleting master item:", error);
        alert("Ocurrió un error al intentar eliminar el elemento.");
      } finally {
        setIsDeleting(false);
      }
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isDeleting}
      type="button"
      style={{
        padding: '0.4rem 0.8rem',
        fontSize: '0.75rem',
        background: 'var(--error)',
        border: 'none',
        borderRadius: '6px',
        color: 'white',
        cursor: isDeleting ? 'not-allowed' : 'pointer',
        opacity: isDeleting ? 0.7 : 1
      }}
    >
      {isDeleting ? "Eliminando..." : label}
    </button>
  );
}

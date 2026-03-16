"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface HelpContent {
  title: string;
  description: string;
  steps?: string[];
  tips?: string[];
}

export default function ContextualHelp({ content }: { content: string | HelpContent }) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Normalize content for internal use
  const normalizedContent: HelpContent = typeof content === 'string' 
    ? { title: "Ayuda Rápida", description: content }
    : content;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div style={{ display: 'inline-block', position: 'relative', verticalAlign: 'middle' }}>
      <button 
        type="button"
        className="help-trigger" 
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        title="Ver ayuda"
        style={{
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          border: '1.5px solid var(--primary)',
          color: 'var(--primary)',
          background: 'var(--primary-light)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.75rem',
          fontWeight: '800',
          cursor: 'pointer',
          padding: 0,
          lineHeight: 1,
          transition: 'all 0.2s',
          marginLeft: '0.5rem'
        }}
      >
        ?
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            ref={popoverRef}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="help-popover"
            style={{
              position: 'absolute',
              top: '100%',
              right: '-10px', // Align to the right of the trigger by default to avoid right-edge overflow
              zIndex: 1000,
              width: 'max-content',
              maxWidth: '320px',
              minWidth: '280px',
              background: 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(16px)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '1.25rem',
              boxShadow: 'var(--shadow-xl)',
              marginTop: '0.75rem',
              // Use viewport-aware calc for very small screens
              maxHeight: '80vh',
              overflowY: 'auto'
            }}
          >
            <h4 style={{ 
              fontSize: '0.9rem', 
              fontWeight: '700', 
              color: 'var(--navy)', 
              marginBottom: '0.75rem', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem',
              lineHeight: 1.2,
              margin: 0,
              paddingBottom: '0.5rem',
              borderBottom: '1px solid rgba(0,0,0,0.05)',
              fontFamily: 'Inter, system-ui, sans-serif'
            }}>
              <span>💡</span> {normalizedContent.title}
            </h4>
            
            <p style={{ 
              fontSize: '13px', 
              color: 'var(--text-muted)', 
              lineHeight: 1.5, 
              margin: '0.75rem 0 0 0',
              fontWeight: '450',
              fontFamily: 'Inter, system-ui, sans-serif'
            }}>
              {normalizedContent.description}
            </p>
            
            {normalizedContent.steps && (
              <div style={{ marginTop: '1rem' }}>
                <strong style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-subtle)', marginBottom: '0.5rem', letterSpacing: '0.025em' }}>
                  Paso a paso:
                </strong>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {normalizedContent.steps.map((step, i) => (
                    <li key={i} style={{ 
                      fontSize: '12px', 
                      color: 'var(--navy-light)', 
                      padding: '0.25rem 0', 
                      display: 'flex', 
                      alignItems: 'flex-start', 
                      gap: '0.5rem',
                      lineHeight: 1.4
                    }}>
                      <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>•</span>
                      {step}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {normalizedContent.tips && (
               <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--primary-light)', borderRadius: '8px', border: '1px solid rgba(14, 165, 233, 0.1)' }}>
                  <strong style={{ display: 'block', fontSize: '11px', color: 'var(--primary)', marginBottom: '0.25rem' }}>Consejo de Calidad:</strong>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--primary-dark)', fontWeight: '500', lineHeight: 1.4 }}>
                    {normalizedContent.tips[0]}
                  </p>
               </div>
            )}

            <div style={{ marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setIsOpen(false)}
                style={{ 
                  background: 'transparent', 
                  border: 'none', 
                  color: 'var(--primary)', 
                  fontSize: '11px', 
                  fontWeight: '700', 
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}
              >
                Cerrar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

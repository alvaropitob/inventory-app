"use client";

import { useState, useRef, useEffect } from "react";

interface HelpContent {
  title: string;
  description: string;
  steps?: string[];
  tips?: string[];
}

export default function ContextualHelp({ content }: { content: HelpContent }) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div style={{ display: 'inline-block', position: 'relative' }}>
      <button 
        type="button"
        className="help-trigger" 
        onClick={() => setIsOpen(!isOpen)}
        title="Ver ayuda"
      >
        ?
      </button>

      {isOpen && (
        <div ref={popoverRef} className="help-popover">
          <h4>
            <span>💡</span> {content.title}
          </h4>
          <p>{content.description}</p>
          
          {content.steps && (
            <div style={{ marginBottom: '1rem' }}>
              <strong style={{ display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-subtle)', marginBottom: '0.5rem' }}>Paso a paso:</strong>
              <ul>
                {content.steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ul>
            </div>
          )}

          {content.tips && (
             <div style={{ padding: '0.75rem', background: 'var(--primary-light)', borderRadius: '8px', border: '1px solid rgba(14, 165, 233, 0.1)' }}>
                <strong style={{ display: 'block', fontSize: '0.75rem', color: 'var(--primary)', marginBottom: '0.25rem' }}>Consejo de Calidad:</strong>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--primary-dark)', fontWeight: '500' }}>
                  {content.tips[0]}
                </p>
             </div>
          )}
        </div>
      )}
    </div>
  );
}

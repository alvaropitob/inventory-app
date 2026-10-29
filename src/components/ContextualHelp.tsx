"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lightbulb } from "lucide-react";

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
    <div className="help-anchor">
      <button 
        type="button"
        className="help-trigger" 
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        title="Ver ayuda"
        aria-label={`Ayuda: ${normalizedContent.title}`}
        aria-expanded={isOpen}
      >
        ?
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            ref={popoverRef}
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="help-popover"
          >
            <h4 className="help-popover-title">
              <Lightbulb className="ui-icon" aria-hidden="true" /> {normalizedContent.title}
            </h4>
            
            <p className="help-popover-text">
              {normalizedContent.description}
            </p>
            
            {normalizedContent.steps && (
              <div className="help-popover-section">
                <strong className="help-popover-label">Paso a paso:</strong>
                <ul className="help-popover-list">
                  {normalizedContent.steps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ul>
              </div>
            )}

            {normalizedContent.tips?.map((tip, i) => (
              <div className="help-popover-tip" key={i}>
                <strong>{normalizedContent.tips!.length > 1 ? `Importante ${i + 1}:` : "Importante:"}</strong>
                <p>{tip}</p>
              </div>
            ))}

            <div className="help-popover-footer">
              <button type="button" className="help-popover-close" onClick={() => setIsOpen(false)}>
                Cerrar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

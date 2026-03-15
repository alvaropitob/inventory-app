"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface HelpProps {
  title: string;
  content: React.ReactNode;
}

export function ContextHelp({ title, content }: HelpProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Prevent scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(true);
        }}
        className="inline-flex items-center justify-center w-6 h-6 ml-2 rounded-full bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition-all shadow-sm active:scale-90"
        aria-label="Ver ayuda contextual"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>
        </svg>
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-navy/40 backdrop-blur-sm"
              style={{ backgroundColor: 'rgba(15, 23, 42, 0.4)' }}
            />

            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3 text-blue-700">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
                      </svg>
                    </div>
                    <h3 className="text-base font-bold tracking-tight text-navy" style={{ fontFamily: 'var(--font-heading), Inter, sans-serif' }}>
                      {title}
                    </h3>
                  </div>
                  <button 
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6 6 18M6 6l12 12"/>
                    </svg>
                  </button>
                </div>

                <div className="text-[13px] text-gray-600 leading-relaxed font-normal" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                  {content}
                </div>

                <div className="mt-6 flex items-center justify-between pt-4 border-t border-gray-50">
                  <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-widest italic">
                    Referencia ISO 15189
                  </span>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
                  >
                    Entendido
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

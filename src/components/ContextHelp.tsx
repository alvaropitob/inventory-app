"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface HelpProps {
  title: string;
  content: React.ReactNode;
}

export function ContextHelp({ title, content }: HelpProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative inline-block ml-2 align-middle">
      <button
        type="button"
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onClick={() => setIsOpen(!isOpen)}
        className="w-5 h-5 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center text-xs font-bold border border-blue-200 hover:bg-blue-100 transition-colors"
        aria-label="Ayuda"
      >
        ?
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="absolute z-50 w-64 p-4 mt-2 bg-white rounded-xl shadow-2xl border border-blue-100 right-0 lg:left-0"
            style={{ filter: 'drop-shadow(0 20px 25px rgb(0 0 0 / 0.1))' }}
          >
            <div className="flex items-center gap-2 mb-2 text-blue-700 font-semibold text-sm">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
              </svg>
              {title}
            </div>
            <div className="text-xs text-gray-600 leading-relaxed font-normal">
              {content}
            </div>
            <div className="mt-3 pt-2 border-t border-gray-50 flex justify-between items-center">
              <span className="text-[10px] text-gray-400 font-medium italic">Normativa ISO 15189</span>
              <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Info</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

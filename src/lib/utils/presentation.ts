/**
 * Utilidades para interpretar presentaciones comerciales y cantidades internas de insumos/reactivos.
 */

/**
 * Extrae el número de unidades/pruebas/tests contenidas en la presentación comercial.
 * Ejemplos:
 *  - "Kit x 100" -> 100
 *  - "Caja por 50 pruebas" -> 50
 *  - "Frasco * 250 determinaciones" -> 250
 *  - "Caja x 20 tubos" -> 20
 *  - "Kit x 100 determinaciones" -> 100
 *  - "100 pruebas" -> 100
 *  - "50 tests" -> 50
 *  - "Caja x 12" -> 12
 *  - "Frasco 500 mL" -> null (no es kit fraccionable por unidades/pruebas)
 */
export function parseUnitsFromPresentation(presentation?: string | null): number | null {
  if (!presentation || typeof presentation !== "string") return null;
  const clean = presentation.trim();
  if (!clean || clean.toLowerCase() === "no aplica") return null;

  // Patrón 1: (x|por|*)\s*(\d+)  -> ej: "Kit x 100", "Caja por 50", "Insumo * 20"
  const matchX = clean.match(/(?:x|por|\*)\s*(\d+)/i);
  if (matchX && matchX[1]) {
    const val = parseInt(matchX[1], 10);
    if (val > 1) return val;
  }

  // Patrón 2: (\d+)\s*(determinaciones|pruebas|tests?|unidades|dosis|tubos|tiras)
  const matchUnit = clean.match(/(\d+)\s*(?:determinaciones|det|pruebas?|tests?|unidades?|dosis|tubos?|tiras?)/i);
  if (matchUnit && matchUnit[1]) {
    const val = parseInt(matchUnit[1], 10);
    if (val > 1) return val;
  }

  return null;
}

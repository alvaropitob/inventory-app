/**
 * Utilidad clínica para parseo de códigos de barras GS1-128 / DataMatrix
 * Utilizados en reactivos diagnósticos in vitro y dispositivos médicos (INVIMA / FDA).
 *
 * Identificadores de Aplicación (AI) estándar:
 * - (01): GTIN / Código de Producto (14 dígitos)
 * - (17): Fecha de Vencimiento (AAMMDD)
 * - (10): Número de Lote (Alfanumérico variable)
 * - (21): Número de Serie
 */

export interface ParsedGS1 {
  gtin: string | null;
  lotNumber: string | null;
  expirationDate: string | null; // ISO YYYY-MM-DD
  raw: string;
}

export function parseGS1Barcode(rawBarcode: string): ParsedGS1 {
  if (!rawBarcode || typeof rawBarcode !== "string") {
    return { gtin: null, lotNumber: null, expirationDate: null, raw: "" };
  }

  const cleaned = rawBarcode.trim();
  let gtin: string | null = null;
  let lotNumber: string | null = null;
  let expirationDate: string | null = null;

  // 1. Formato con paréntesis: (01)07701234567890(17)261231(10)LOT12345
  if (cleaned.includes("(") && cleaned.includes(")")) {
    const gtinMatch = cleaned.match(/\(01\)(\d{14}|\d{8}|\d{12}|\d{13})/);
    if (gtinMatch) gtin = gtinMatch[1];

    const expMatch = cleaned.match(/\(17\)(\d{6})/);
    if (expMatch) {
      expirationDate = parseYYMMDD(expMatch[1]);
    }

    const lotMatch = cleaned.match(/\(10\)([^\(\s]+)/);
    if (lotMatch) lotNumber = lotMatch[1];

    return { gtin, lotNumber, expirationDate, raw: cleaned };
  }

  // 2. Formato continuo estándar (FNC1 parse): 01...17...10...
  let cursor = cleaned.replace(/[\x1D\u001D]/g, ""); // Remover caracteres FNC1 / GS separator

  if (cursor.startsWith("01") && cursor.length >= 16) {
    gtin = cursor.substring(2, 16);
    cursor = cursor.substring(16);
  }

  if (cursor.startsWith("17") && cursor.length >= 8) {
    const rawExp = cursor.substring(2, 8);
    expirationDate = parseYYMMDD(rawExp);
    cursor = cursor.substring(8);
  }

  if (cursor.startsWith("10") && cursor.length > 2) {
    lotNumber = cursor.substring(2);
  }

  // 3. Fallback: Si no tiene identificadores AI, asumimos que puede ser el lote o el SKU directamente
  if (!gtin && !lotNumber && !expirationDate) {
    if (/^\d{8,14}$/.test(cleaned)) {
      gtin = cleaned;
    } else {
      lotNumber = cleaned;
    }
  }

  return { gtin, lotNumber, expirationDate, raw: cleaned };
}

function parseYYMMDD(yymmdd: string): string | null {
  if (yymmdd.length !== 6) return null;
  const yy = parseInt(yymmdd.substring(0, 2), 10);
  const mm = yymmdd.substring(2, 4);
  const dd = yymmdd.substring(4, 6);

  // Considerar siglo 2000 para años 00-79, 1900 para 80-99
  const fullYear = yy < 80 ? 2000 + yy : 1900 + yy;
  const monthNum = parseInt(mm, 10);
  const dayNum = parseInt(dd, 10);

  if (monthNum < 1 || monthNum > 12) return null;
  // Si el día es 00 (indicando sólo mes/año), se asume el último día del mes
  const validDay = dayNum === 0 ? "28" : dd;

  return `${fullYear}-${mm}-${validDay}`;
}

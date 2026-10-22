export function validateEnvironmentalReading(input: {
  alreadyRegistered: boolean;
  isCorrection: boolean;
  notes: string;
}): string | null {
  if (input.alreadyRegistered && !input.isCorrection) {
    return "Ya existe una lectura para esta ubicación, fecha y turno. Marca la corrección e indica el motivo si necesitas registrar una corrección.";
  }
  if (input.isCorrection && !input.alreadyRegistered) {
    return "No existe una lectura previa de este turno para corregir.";
  }
  if (input.isCorrection && !input.notes.trim()) {
    return "Indica el motivo de la corrección de la lectura.";
  }
  return null;
}

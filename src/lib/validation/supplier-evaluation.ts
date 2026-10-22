export type SupplierEvaluationAnswers = Record<string, number | null>;

export function calculateSupplierEvaluation(answers: SupplierEvaluationAnswers) {
  const applicable = Object.values(answers).filter((score): score is number => score !== null);
  const sum = applicable.reduce((total, score) => total + score, 0);
  const pointsPossible = applicable.length * 4;
  const percentageScore = pointsPossible ? Math.round((sum / pointsPossible) * 10000) / 100 : 0;
  const rating = percentageScore >= 76 ? "EXCELENTE" : percentageScore >= 51 ? "BUENO" : percentageScore >= 26 ? "REGULAR" : "MALO";
  const average = (indices: number[]) => {
    const values = indices.map(index => answers[`question_${index}`]).filter((score): score is number => score !== null && score !== undefined);
    return values.length ? 1 + values.reduce((total, score) => total + score, 0) / values.length : 1;
  };

  return {
    applicableQuestions: applicable.length,
    pointsPossible,
    percentageScore,
    rating,
    criteriaQuality: average([1, 2]),
    criteriaDeliveryTime: average([7, 8]),
    criteriaSupport: average([13, 14]),
  };
}

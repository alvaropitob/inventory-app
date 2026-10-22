import { describe, expect, it } from "vitest";
import { calculateSupplierEvaluation } from "@/lib/validation/supplier-evaluation";

describe("supplier evaluation scoring", () => {
  it("excludes not-applicable answers from the possible score", () => {
    const result = calculateSupplierEvaluation({
      question_1: 4,
      question_2: null,
      question_3: 0,
    });

    expect(result.applicableQuestions).toBe(2);
    expect(result.pointsPossible).toBe(8);
    expect(result.percentageScore).toBe(50);
    expect(result.rating).toBe("REGULAR");
  });

  it("maps the score to the top rating and computes criterion averages", () => {
    const result = calculateSupplierEvaluation({
      question_1: 4,
      question_2: 4,
      question_7: 2,
      question_8: null,
      question_13: 3,
      question_14: 4,
    });

    expect(result.percentageScore).toBe(85);
    expect(result.rating).toBe("EXCELENTE");
    expect(result.criteriaQuality).toBe(5);
    expect(result.criteriaDeliveryTime).toBe(3);
    expect(result.criteriaSupport).toBe(4.5);
  });
});

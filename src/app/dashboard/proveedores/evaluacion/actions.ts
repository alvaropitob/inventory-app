"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ComplianceService } from "@/lib/services/compliance";
import { requireRole } from "@/lib/supabase/authorization";
import { calculateSupplierEvaluation } from "@/lib/validation/supplier-evaluation";
import { isValidDateKey } from "@/lib/dates";

export async function submitSupplierEvaluation(formData: FormData) {
  await requireRole(["admin", "supervisor"]);
  const supplier_id = String(formData.get("supplier_id") || "");
  const supplier_email = String(formData.get("supplier_email") || "").trim();
  const evaluation_date = String(formData.get("evaluation_date") || "");
  const evaluator_name = String(formData.get("evaluator_name") || "").trim();
  const evaluator_role = String(formData.get("evaluator_role") || "").trim();
  const comments = String(formData.get("comments") || "").trim();

  const answers: Record<string, number | null> = {};
  for (let index = 1; index <= 14; index += 1) {
    const answer = String(formData.get(`question_${index}`) || "");
    if (answer === "na") answers[`question_${index}`] = null;
    else if (/^[0-4]$/.test(answer)) answers[`question_${index}`] = Number(answer);
    else throw new Error("Responde cada pregunta o marca No aplicable.");
  }

  const evaluation = calculateSupplierEvaluation(answers);
  if (!supplier_id || !supplier_email || !evaluator_name || !evaluator_role || !isValidDateKey(evaluation_date) || evaluation.applicableQuestions === 0) {
    throw new Error("Completa los datos de la evaluación y al menos una pregunta aplicable.");
  }

  try {
    await ComplianceService.evaluateSupplier({
      supplier_id,
      supplier_email,
      evaluation_date,
      evaluator_name,
      evaluator_role,
      answers,
      applicable_questions: evaluation.applicableQuestions,
      points_possible: evaluation.pointsPossible,
      percentage_score: evaluation.percentageScore,
      rating: evaluation.rating,
      criteria_quality: evaluation.criteriaQuality,
      criteria_delivery_time: evaluation.criteriaDeliveryTime,
      criteria_support: evaluation.criteriaSupport,
      comments,
    });
    revalidatePath("/dashboard/proveedores/evaluacion");
    revalidatePath("/dashboard/reportes");
  } catch (error: unknown) {
    console.error("Error submitting supplier evaluation:", error);
    throw error;
  }

  redirect("/dashboard/proveedores/evaluacion");
}

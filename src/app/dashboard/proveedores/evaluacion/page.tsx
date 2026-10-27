import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/services/user";
import { CatalogService } from "@/lib/services/catalog";
import { ComplianceService } from "@/lib/services/compliance";
import * as Actions from "./actions";
import SupplierEvaluationFields from "@/components/SupplierEvaluationFields";
import { getDateKeyInBusinessTimeZone } from "@/lib/dates";

export const dynamic = "force-dynamic";

const questionGroups = [
  { title: "Calidad de los productos o servicios", questions: [
    "¿Los productos o servicios cumplen con los estándares de calidad requeridos?",
    "¿Se han identificado defectos o problemas de calidad en el pasado?",
  ] },
  { title: "Cumplimiento de normativas y regulaciones", questions: [
    "¿El proveedor cumple con todas las normativas y regulaciones relevantes?",
    "¿Proporciona documentación y certificaciones?",
  ] },
  { title: "Experiencia y reputación en el mercado", questions: [
    "¿Tiene el proveedor experiencia y trayectoria en el suministro de productos o servicios similares?",
    "¿Qué reputación tiene en el sector?",
  ] },
  { title: "Capacidad de entrega y cumplimiento de plazos", questions: [
    "¿El proveedor entrega en los plazos acordados?",
    "¿Ha habido retrasos en entregas pasadas?",
  ] },
  { title: "Costo y condiciones comerciales", questions: [
    "¿Los precios son competitivos?",
    "¿Existen condiciones favorables como descuentos por volumen o términos de pago flexibles?",
  ] },
  { title: "Gestión de cartera", questions: [
    "¿Se emiten facturas de manera oportuna y precisa por los servicios prestados o los productos suministrados?",
    "¿Las facturas incluyen toda la información necesaria, como detalles de los servicios/productos, fechas, términos de pago y montos adeudados?",
  ] },
  { title: "Servicio al cliente y soporte técnico", questions: [
    "¿Ofrece un servicio al cliente eficiente?",
    "¿Proporciona soporte técnico adecuado?",
  ] },
];

const scoreOptions = [
  ["na", "No aplicable"], ["0", "No cumple"], ["1", "Cumple mínimamente"],
  ["2", "Cumple parcialmente"], ["3", "Cumple plenamente"], ["4", "Supera las expectativas"],
];

export default async function EvaluacionProveedoresPage() {
  const user = await getCurrentUserProfile();
  if (!user) redirect("/auth/login");

  const [suppliers, evaluations] = await Promise.all([
    CatalogService.getSuppliers(),
    ComplianceService.getSupplierEvaluations(),
  ]);
  const today = getDateKeyInBusinessTimeZone(new Date());
  let questionNumber = 0;

  return (
    <div className="dashboard-main supplier-evaluation-page">
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Evaluación de Proveedores</h1>
          <p className="page-header-subtitle">Califica el desempeño con una escala común y conserva las respuestas por criterio.</p>
        </div>
      </div>

      <div className="eval-grid">
        <div className="table-card">
          <div className="card-section-header"><h2 className="card-section-title">Evaluaciones recientes</h2></div>
          <div className="table-responsive">
            <table className="data-table supplier-evaluation-table">
              <thead><tr><th>Fecha</th><th>Proveedor</th><th>Evaluador</th><th>Preguntas aplicables</th><th>Calificación</th><th className="cell-center">Puntaje</th></tr></thead>
              <tbody>
                {evaluations.map(ev => (
                  <tr key={ev.id}>
                    <td>{new Date(ev.evaluation_date).toLocaleDateString("es-CO")}</td>
                    <td className="cell-primary">{ev.supplier?.name}</td>
                    <td>{ev.evaluator_name || "—"}</td>
                    <td>{ev.applicable_questions == null ? "—" : `${ev.applicable_questions} / 14 (${ev.points_possible} puntos posibles)`}</td>
                    <td>{ev.rating || "—"}</td>
                    <td className="cell-center">{ev.percentage_score == null ? `${Number(ev.total_score).toFixed(1)} / 5` : `${Number(ev.percentage_score).toFixed(1)}%`}</td>
                  </tr>
                ))}
                {evaluations.length === 0 && <tr><td colSpan={6} className="workflow-empty-state"><strong>Sin evaluaciones registradas</strong></td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="form-card supplier-evaluation-form-card">
          <div className="form-card-header"><h2 className="form-card-title supplier-evaluation-form-title">Nueva evaluación</h2></div>
          <form action={Actions.submitSupplierEvaluation} className="form-card-body form-fields evaluation-form">
            <SupplierEvaluationFields suppliers={suppliers.data?.map(s => ({ id: s.id, name: s.name, contact_email: s.contact_email })) || []} />
            <div className="form-grid-2">
              <div><label className="form-label">Fecha de evaluación *</label><input type="date" name="evaluation_date" required defaultValue={today} className="form-input" /></div>
              <div><label className="form-label">Nombre de quien evalúa *</label><input name="evaluator_name" required defaultValue={user.fullName || ""} className="form-input" /></div>
              <div><label className="form-label">Cargo *</label><input name="evaluator_role" required className="form-input" placeholder="Ej. Coordinación de Calidad" /></div>
            </div>

            <div className="form-fields evaluation-question-groups">
              <div>
                <h3 className="card-section-title">Sistema de puntuación</h3>
                <p className="card-section-subtitle">0 No cumple · 1 Cumple mínimamente · 2 Cumple parcialmente · 3 Cumple plenamente · 4 Supera las expectativas. Las respuestas No aplicable se excluyen del máximo posible.</p>
              </div>
              {questionGroups.map(group => (
                <section key={group.title} className="form-section">
                  <h3 className="form-section-title">{group.title}</h3>
                  {group.questions.map(question => {
                    questionNumber += 1;
                    return <div key={question} className="form-group evaluation-question">
                      <label className="form-label">{questionNumber}. {question}</label>
                      <select name={`question_${questionNumber}`} required defaultValue="" className="form-select">
                        <option value="" disabled>Seleccione una respuesta...</option>
                        {scoreOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </div>;
                  })}
                </section>
              ))}
            </div>

            <div><label className="form-label">Observaciones</label><textarea name="comments" rows={4} className="form-textarea" placeholder="Observaciones y acciones de seguimiento" /></div>
            <button type="submit" className="btn-primary btn-block">Guardar evaluación</button>
          </form>
        </div>
      </div>
    </div>
  );
}

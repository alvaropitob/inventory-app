"use client";

import { useState } from "react";

type ProductType = "medicamento" | "dispositivo_medico" | "reactivo" | "insumo";
interface Values {
  product_type?: ProductType | null;
  section_id?: string | null;
  purchase_unit?: string | null;
  commercial_name?: string | null;
  sanitary_registration?: string | null;
  brand?: string | null;
  active_ingredient?: string | null;
  dosage_form?: string | null;
  concentration?: string | null;
  commercial_presentation?: string | null;
  shelf_life?: string | null;
  product_description?: string | null;
  risk_classification?: "I" | "II" | "IIA" | "IIB" | "III" | "not_applicable" | null;
  series?: string | null;
}

interface Supplier { id: string; name: string; }
interface Section { id: string; name: string; }

export default function ProductTechnicalFields({
  initial,
  suppliers = [],
  sections = [],
  batchNumber = "",
  expirationDate = "",
  supplierId = "",
  supplierRequired = false,
  configurationMode = false,
}: {
  initial?: Values | null;
  suppliers?: Supplier[];
  sections?: Section[];
  batchNumber?: string;
  expirationDate?: string;
  supplierId?: string;
  supplierRequired?: boolean;
  configurationMode?: boolean;
}) {
  const [type, setType] = useState<ProductType | "">(initial?.product_type || "");
  const isMedicine = type === "medicamento";
  const isQaTrackedType = type === "dispositivo_medico" || type === "reactivo" || type === "insumo";
  const typeField = <div>
    <label className="form-label">Tipo de producto *</label>
    <select name="product_type" required className="form-select" value={type} onChange={event => setType(event.target.value as ProductType | "")}>
      <option value="">Seleccione el tipo de producto...</option>
      <option value="medicamento">Medicamento</option>
      <option value="dispositivo_medico">Dispositivo médico</option>
      <option value="reactivo">Reactivo</option>
      <option value="insumo">Insumo</option>
    </select>
  </div>;

  return <div className={`form-fields${configurationMode ? " config-product-fields" : ""}`}>
    {!configurationMode && typeField}

    <div>
      <label className="form-label">Marca{isQaTrackedType ? " *" : ""}</label>
      <input name="brand" defaultValue={initial?.brand || ""} className="form-input" required={isQaTrackedType} placeholder="Escriba No aplica si corresponde" />
    </div>
    <div>
      <label className="form-label">Descripción{isQaTrackedType ? " *" : ""}</label>
      <textarea name="product_description" defaultValue={initial?.product_description || ""} className="form-textarea" rows={2} required={isQaTrackedType} placeholder="Descripción o No aplica" />
    </div>
    {(configurationMode || isQaTrackedType) && <div>
      <label className="form-label">Serie{isQaTrackedType ? " *" : ""}</label>
      <input name="series" defaultValue={initial?.series || ""} className="form-input" required={isQaTrackedType} placeholder="Serie" />
    </div>}
    <div>
      <label className="form-label">Principio activo{isMedicine ? " *" : ""}</label>
      <input name="active_ingredient" defaultValue={initial?.active_ingredient || ""} className="form-input" required={isMedicine} placeholder="Escriba No aplica si corresponde" />
    </div>
    <div>
      <label className="form-label">Forma farmacéutica{isMedicine ? " *" : ""}</label>
      <input name="dosage_form" defaultValue={initial?.dosage_form || ""} className="form-input" required={isMedicine} placeholder="Solución, polvo, etc." />
    </div>
    <div>
      <label className="form-label">Concentración{isMedicine ? " *" : ""}</label>
      <input name="concentration" defaultValue={initial?.concentration || ""} className="form-input" required={isMedicine} placeholder="Ej. 70 %; No aplica" />
    </div>

    <div>
      <label className="form-label">Lote{configurationMode ? "" : " *"}</label>
      <input name="batch_number" defaultValue={batchNumber} required={!configurationMode} placeholder="Ej: LOT-2024-001" className="form-input" />
    </div>
    <div>
      <label className="form-label">Fecha de vencimiento{configurationMode ? "" : " *"}</label>
      <input type="date" name="expiration_date" defaultValue={expirationDate} required={!configurationMode} className="form-input" />
    </div>
    <div>
      <label className="form-label">Presentación comercial *</label>
      <input name="commercial_presentation" defaultValue={initial?.commercial_name || initial?.commercial_presentation || ""} className="form-input" required placeholder="Ej: Kit x 100 Det" />
    </div>
    <div>
      <label className="form-label">Unidad de medida *</label>
      <input name="purchase_unit" defaultValue={initial?.purchase_unit || "Unidad"} className="form-input" required placeholder="Ej: Frasco x 500 ml" />
    </div>
    <div>
      <label className="form-label">Registro INVIMA{isMedicine || isQaTrackedType ? " *" : ""}</label>
      <input name="sanitary_registration" defaultValue={initial?.sanitary_registration || ""} className="form-input" required={isMedicine || isQaTrackedType} placeholder="Registro o No aplica" />
    </div>
    <div>
      <label className="form-label">Clasificación del riesgo{isQaTrackedType ? " *" : ""}</label>
      <select name="risk_classification" required={isQaTrackedType} defaultValue={initial?.risk_classification || ""} className="form-select">
        <option value="">Seleccione...</option>
        <option value="I">I</option>
        <option value="II">II</option>
        <option value="IIA">IIA</option>
        <option value="IIB">IIB</option>
        <option value="III">III</option>
        <option value="not_applicable">No aplica</option>
      </select>
    </div>
    <div>
      <label className="form-label">Vida útil{isQaTrackedType ? " *" : ""}</label>
      <input name="shelf_life" defaultValue={initial?.shelf_life || ""} className="form-input" required={isQaTrackedType} placeholder="Ej. 2 años; No aplica" />
    </div>
    <div>
      <label className="form-label">Proveedor{supplierRequired || isQaTrackedType ? " *" : ""}</label>
      <select name="supplier_id" defaultValue={supplierId} className="form-select" required={supplierRequired || isQaTrackedType}>
        <option value="">Seleccione proveedor o No aplica...</option>
        <option value="not_applicable">No aplica</option>
        {suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
      </select>
    </div>

    {configurationMode && <>
      <div>
        <label className="form-label">Área *</label>
        <select className="form-select" name="section_id" defaultValue={initial?.section_id || ""} required>
          <option value="">Seleccione...</option>
          {sections.map(section => <option key={section.id} value={section.id}>{section.name}</option>)}
        </select>
      </div>
      {typeField}
      <input type="hidden" name="commercial_name" value={initial?.commercial_name || ""} />
    </>}
    {!configurationMode && <div>
      <label className="form-label">Presentación / nombre comercial</label>
      <input name="commercial_name" defaultValue={initial?.commercial_name || ""} className="form-input" placeholder="Marca, nombre o referencia" />
    </div>}
    {!configurationMode && <p className="cell-secondary">Complete los datos aplicables al tipo de producto. Si un campo no corresponde, escriba “No aplica”.</p>}
  </div>;
}

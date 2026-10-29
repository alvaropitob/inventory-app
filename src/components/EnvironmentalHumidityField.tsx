"use client";

import { useState } from "react";

export default function EnvironmentalHumidityField() {
  const [notApplicable, setNotApplicable] = useState(false);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: ".5rem" }}>
        <label className="form-label" htmlFor="environmental-humidity">Humedad (%)</label>
        <label style={{ display: "inline-flex", alignItems: "center", gap: ".35rem", fontSize: "var(--fs-xs)" }}>
          <input
            type="checkbox"
            name="humidity_not_applicable"
            checked={notApplicable}
            onChange={event => setNotApplicable(event.target.checked)}
            style={{ width: "auto" }}
          />
          N/A
        </label>
      </div>
      <input
        id="environmental-humidity"
        type="number"
        step="0.1"
        name="humidity"
        required={!notApplicable}
        disabled={notApplicable}
        placeholder={notApplicable ? "No aplica" : "Ej: 45"}
        className="form-input"
      />
    </div>
  );
}

import { useState } from "react";
import api from "./api";

function MacoForm() {
  const [form, setForm] = useState({
    product_from: "",
    product_to: "",
    equipment_id: "",
    min_therapeutic_dose_mg: "",
    next_batch_size_kg: "",
    max_daily_dose_mg: "",
    pde_mg_day: "",
    safety_factor: 1,
    shared_surface_area_cm2: ""
  });

  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const submitForm = async () => {
    try {
      setError(null);
      const response = await api.post("/maco/calculate", form);
      setResult(response.data);
    } catch (err) {
      setError("Calculation failed. Please check inputs.");
    }
  };

  return (
    <div style={{ marginTop: "20px" }}>
      <h2>MACO Calculation Form</h2>

      <input name="product_from" placeholder="Product From" onChange={handleChange} />
      <br />

      <input name="product_to" placeholder="Product To" onChange={handleChange} />
      <br />

      <input name="equipment_id" placeholder="Equipment ID" onChange={handleChange} />
      <br />

      <input name="min_therapeutic_dose_mg" placeholder="Min Therapeutic Dose (mg)" onChange={handleChange} />
      <br />

      <input name="next_batch_size_kg" placeholder="Next Batch Size (kg)" onChange={handleChange} />
      <br />

      <input name="max_daily_dose_mg" placeholder="Max Daily Dose (mg/day)" onChange={handleChange} />
      <br />

      <input name="pde_mg_day" placeholder="PDE (mg/day)" onChange={handleChange} />
      <br />

      <input name="safety_factor" value={form.safety_factor} onChange={handleChange} />
      <br />

      <input name="shared_surface_area_cm2" placeholder="Surface Area (cm²)" onChange={handleChange} />
      <br /><br />

      <button onClick={submitForm}>Calculate MACO</button>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {result && (
        <div style={{ marginTop: "20px" }}>
          <h3>MACO Results</h3>

          <p><b>Calculation ID:</b> {result.calc_id}</p>
          <p><b>Governing Method:</b> {result.governing_method}</p>

          <table border="1" cellPadding="6" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th>Method</th>
                <th>MACO (µg)</th>
                <th>Limit (µg/cm²)</th>
                <th>Governing</th>
              </tr>
            </thead>
            <tbody>
              {result.methods.map((row, index) => (
                <tr
                  key={index}
                  style={{ backgroundColor: row.is_governing ? "#d4edda" : "white" }}
                >
                  <td>{row.method}</td>
                  <td>{row.maco_ug}</td>
                  <td>{row.limit_ugcm2 ?? "-"}</td>
                  <td>{row.is_governing ? "✅" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default MacoForm;
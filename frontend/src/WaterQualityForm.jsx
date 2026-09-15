import { useEffect, useState } from "react";

const API_URL = "http://127.0.0.1:8000";

function WaterQualityForm() {
  const [sources, setSources] = useState([]);
  const [message, setMessage] = useState("");

  const [formData, setFormData] = useState({
    water_source_id: "",
    ph: "",
    turbidity: "Normal",
    residual_chlorine: "Normal",
    microbial_contamination: false,
    tested_by: "Field Water Quality Worker",
  });

  // ============================================================
  // LOAD WATER SOURCES
  // ============================================================

  useEffect(() => {
    fetch(`${API_URL}/water-sources`)
      .then((response) => response.json())
      .then((data) => setSources(data))
      .catch((error) => {
        console.error("Error loading water sources:", error);
      });
  }, []);

  // ============================================================
  // HANDLE FORM CHANGES
  // ============================================================

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  // ============================================================
  // SUBMIT WATER TEST
  // ============================================================

  const submitWaterTest = async (event) => {
    event.preventDefault();

    setMessage("");

    if (!formData.water_source_id) {
      setMessage("Please select a water source.");
      return;
    }

    if (!formData.ph) {
      setMessage("Please enter the pH value.");
      return;
    }

    const payload = {
      ...formData,
      water_source_id: Number(formData.water_source_id),
      ph: Number(formData.ph),
    };

    try {
      const response = await fetch(`${API_URL}/water-tests`, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(
          data.detail || "Unable to submit water quality report."
        );
        return;
      }

      setMessage(
        `Water test submitted successfully for ${data.water_source}. NeerNayan risk analysis updated.`
      );

      setFormData({
        water_source_id: "",
        ph: "",
        turbidity: "Normal",
        residual_chlorine: "Normal",
        microbial_contamination: false,
        tested_by: "Field Water Quality Worker",
      });
    } catch (error) {
      console.error(error);

      setMessage("Could not connect to NeerNayan backend.");
    }
  };

  return (
    <>
      {/* ======================================================
          PAGE HEADING
      ====================================================== */}

      <div className="intro water-intro">
        <p className="eyebrow">
          WATER QUALITY SURVEILLANCE
        </p>

        <h1>Water Quality Report</h1>

        <p>
          Record field-test results for community drinking-water
          sources. New readings are automatically included in
          NeerNayan&apos;s risk analysis.
        </p>
      </div>

      {/* ======================================================
          WATER QUALITY FORM
      ====================================================== */}

      <div className="report-card water-card">
        <form
          className="water-quality-form"
          onSubmit={submitWaterTest}
        >
          {/* WATER SOURCE */}

          <div className="form-field">
            <label htmlFor="water_source_id">
              Water Source
            </label>

            <select
              id="water_source_id"
              name="water_source_id"
              value={formData.water_source_id}
              onChange={handleChange}
            >
              <option value="">
                Select water source
              </option>

              {sources.map((source) => (
                <option
                  key={source.id}
                  value={source.id}
                >
                  {source.source_code} — {source.source_name}
                </option>
              ))}
            </select>
          </div>

          {/* PH + TURBIDITY */}

          <div className="water-form-grid">
            <div className="form-field">
              <label htmlFor="ph">
                pH Value
              </label>

              <input
                id="ph"
                type="number"
                step="0.1"
                min="0"
                max="14"
                name="ph"
                value={formData.ph}
                onChange={handleChange}
                placeholder="Example: 7.2"
              />
            </div>

            <div className="form-field">
              <label htmlFor="turbidity">
                Turbidity
              </label>

              <select
                id="turbidity"
                name="turbidity"
                value={formData.turbidity}
                onChange={handleChange}
              >
                <option value="Normal">
                  Normal
                </option>

                <option value="Moderate">
                  Moderate
                </option>

                <option value="High">
                  High
                </option>
              </select>
            </div>
          </div>

          {/* RESIDUAL CHLORINE */}

          <div className="form-field">
            <label htmlFor="residual_chlorine">
              Residual Chlorine
            </label>

            <select
              id="residual_chlorine"
              name="residual_chlorine"
              value={formData.residual_chlorine}
              onChange={handleChange}
            >
              <option value="Normal">
                Normal
              </option>

              <option value="Low">
                Low
              </option>

              <option value="High">
                High
              </option>
            </select>
          </div>

          {/* MICROBIAL CONTAMINATION */}

          <div className="contamination-box">
            <label className="contamination-check">
              <input
                type="checkbox"
                name="microbial_contamination"
                checked={formData.microbial_contamination}
                onChange={handleChange}
              />

              <div>
                <strong>
                  Microbial contamination detected
                </strong>

                <span>
                  Select this when the field or laboratory
                  test indicates microbial contamination.
                </span>
              </div>
            </label>
          </div>

          {/* TESTED BY */}

          <div className="form-field">
            <label htmlFor="tested_by">
              Tested By
            </label>

            <input
              id="tested_by"
              type="text"
              name="tested_by"
              value={formData.tested_by}
              onChange={handleChange}
            />
          </div>

          {/* SUBMIT */}

          <button
            type="submit"
            className="submit-button"
          >
            Submit Water Quality Report
          </button>

          {message && (
            <div className="message">
              {message}
            </div>
          )}
        </form>
      </div>
    </>
  );
}

export default WaterQualityForm;
import { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function CitizenReport() {
  const [villages, setVillages] = useState([]);
  const [message, setMessage] = useState("");

  const [formData, setFormData] = useState({
    village_id: "",
    people_affected: 1,

    diarrhea: false,
    vomiting: false,
    fever: false,
    jaundice: false,
    abdominal_pain: false,

    symptom_start: "",
    used_community_water: true,
    reporter_name: "",
  });

  // ============================================================
  // LOAD VILLAGES
  // ============================================================

  useEffect(() => {
    fetch(`${API_URL}/villages`)
      .then((response) => response.json())
      .then((data) => setVillages(data))
      .catch((error) => {
        console.error("Error loading villages:", error);
      });
  }, []);

  // ============================================================
  // HANDLE INPUT CHANGE
  // ============================================================

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  // ============================================================
  // SUBMIT CITIZEN REPORT
  // ============================================================

  const submitReport = async (event) => {
    event.preventDefault();

    setMessage("");

    if (!formData.village_id) {
      setMessage("Please select your village.");
      return;
    }

    const hasSymptom =
      formData.diarrhea ||
      formData.vomiting ||
      formData.fever ||
      formData.jaundice ||
      formData.abdominal_pain;

    if (!hasSymptom) {
      setMessage("Please select at least one symptom.");
      return;
    }

    const payload = {
      ...formData,

      village_id: Number(formData.village_id),

      people_affected: Number(
        formData.people_affected
      ),

      reporter_name:
        formData.reporter_name.trim() ||
        "Anonymous",
    };

    try {
      const response = await fetch(
        `${API_URL}/citizen-reports`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(
          data.detail ||
            "Unable to submit health report."
        );

        return;
      }

      setMessage(
        `Report submitted successfully for ${data.village}. Status: ${data.verification_status}. A health worker should verify this signal.`
      );

      setFormData({
        village_id: "",
        people_affected: 1,

        diarrhea: false,
        vomiting: false,
        fever: false,
        jaundice: false,
        abdominal_pain: false,

        symptom_start: "",
        used_community_water: true,
        reporter_name: "",
      });
    } catch (error) {
      console.error(error);

      setMessage(
        "Could not connect to NeerNayan backend."
      );
    }
  };

  return (
    <>
      <div className="intro">
        <p className="eyebrow">
          COMMUNITY SELF-REPORTING
        </p>

        <h1>Citizen Health Report</h1>

        <p>
          Report symptoms noticed in yourself or your
          household. Citizen reports are treated as
          early community signals and require health
          worker verification.
        </p>
      </div>

      <div className="report-card citizen-card">
        <div className="citizen-notice">
          <strong>
            This form does not provide a medical diagnosis.
          </strong>

          <span>
            Report symptoms only. Seek appropriate medical
            care when required.
          </span>
        </div>

        <form onSubmit={submitReport}>
          {/* VILLAGE */}

          <div className="form-field">
            <label htmlFor="citizen-village">
              Village
            </label>

            <select
              id="citizen-village"
              name="village_id"
              value={formData.village_id}
              onChange={handleChange}
            >
              <option value="">
                Select your village
              </option>

              {villages.map((village) => (
                <option
                  key={village.id}
                  value={village.id}
                >
                  {village.name}
                </option>
              ))}
            </select>
          </div>

          {/* PEOPLE + START DATE */}

          <div className="water-form-grid">
            <div className="form-field">
              <label htmlFor="people_affected">
                People affected
              </label>

              <input
                id="people_affected"
                type="number"
                min="1"
                name="people_affected"
                value={formData.people_affected}
                onChange={handleChange}
              />
            </div>

            <div className="form-field">
              <label htmlFor="symptom_start">
                When did symptoms start?
              </label>

              <input
                id="symptom_start"
                type="date"
                name="symptom_start"
                value={formData.symptom_start}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* SYMPTOMS */}

          <div className="symptoms">
            <h3>Symptoms Observed</h3>

            <label className="check">
              <input
                type="checkbox"
                name="diarrhea"
                checked={formData.diarrhea}
                onChange={handleChange}
              />

              Diarrhoea
            </label>

            <label className="check">
              <input
                type="checkbox"
                name="vomiting"
                checked={formData.vomiting}
                onChange={handleChange}
              />

              Vomiting
            </label>

            <label className="check">
              <input
                type="checkbox"
                name="fever"
                checked={formData.fever}
                onChange={handleChange}
              />

              Fever
            </label>

            <label className="check">
              <input
                type="checkbox"
                name="jaundice"
                checked={formData.jaundice}
                onChange={handleChange}
              />

              Jaundice
            </label>

            <label className="check">
              <input
                type="checkbox"
                name="abdominal_pain"
                checked={formData.abdominal_pain}
                onChange={handleChange}
              />

              Abdominal Pain
            </label>
          </div>

          {/* COMMUNITY WATER */}

          <div className="contamination-box">
            <label className="contamination-check">
              <input
                type="checkbox"
                name="used_community_water"
                checked={
                  formData.used_community_water
                }
                onChange={handleChange}
              />

              <div>
                <strong>
                  Used community drinking-water source
                </strong>

                <span>
                  Select this if the affected person
                  recently consumed water from the local
                  community source.
                </span>
              </div>
            </label>
          </div>

          {/* NAME */}

          <div className="form-field">
            <label htmlFor="reporter_name">
              Name (Optional)
            </label>

            <input
              id="reporter_name"
              type="text"
              name="reporter_name"
              value={formData.reporter_name}
              onChange={handleChange}
              placeholder="Leave blank to report anonymously"
            />
          </div>

          <button
            type="submit"
            className="submit-button"
          >
            Submit Community Health Signal
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

export default CitizenReport;
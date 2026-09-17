import { useEffect, useState } from "react";
import "./App.css";

import WaterQualityForm from "./WaterQualityForm";
import CitizenReport from "./CitizenReport";
import DistrictDashboard from "./DistrictDashboard";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function App() {
  const [activePortal, setActivePortal] = useState("asha");

  const [villages, setVillages] = useState([]);
  const [network, setNetwork] = useState([]);

  const [language, setLanguage] = useState("en-IN");
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    village_id: "",
    people_affected: "",
    diarrhea: false,
    vomiting: false,
    fever: false,
    jaundice: false,
    abdominal_pain: false,
  });

  // ============================================================
  // LOAD VILLAGES + WATER NETWORK
  // ============================================================

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [villageResponse, networkResponse] =
          await Promise.all([
            fetch(`${API_URL}/villages`),
            fetch(`${API_URL}/network`),
          ]);

        if (!villageResponse.ok || !networkResponse.ok) {
          throw new Error("Unable to load reporting data.");
        }

        const villageData = await villageResponse.json();
        const networkData = await networkResponse.json();

        setVillages(villageData);
        setNetwork(networkData);
      } catch (error) {
        console.error(error);

        setMessage(
          "Could not load villages. Make sure the backend is running."
        );
      }
    };

    loadInitialData();
  }, []);

  // ============================================================
  // FIND SOURCE CONNECTED TO SELECTED VILLAGE
  // ============================================================

  const selectedNetwork = network.find(
    (item) =>
      Number(item.village_id) ===
      Number(form.village_id)
  );

  // ============================================================
  // FORM HANDLING
  // ============================================================

  const handleChange = (event) => {
    const { name, value, type, checked } =
      event.target;

    setForm((previous) => ({
      ...previous,

      [name]:
        type === "checkbox"
          ? checked
          : value,
    }));
  };

  // ============================================================
  // DIGIT NORMALISATION
  // Supports English + Devanagari + Assamese/Bengali digits
  // ============================================================

  const normalizeDigits = (text) => {
    const devanagariDigits = {
      "०": "0",
      "१": "1",
      "२": "2",
      "३": "3",
      "४": "4",
      "५": "5",
      "६": "6",
      "७": "7",
      "८": "8",
      "९": "9",
    };

    const bengaliAssameseDigits = {
      "০": "0",
      "১": "1",
      "২": "2",
      "৩": "3",
      "৪": "4",
      "৫": "5",
      "৬": "6",
      "৭": "7",
      "৮": "8",
      "৯": "9",
    };

    return text
      .split("")
      .map(
        (character) =>
          devanagariDigits[character] ||
          bengaliAssameseDigits[character] ||
          character
      )
      .join("");
  };

  // ============================================================
  // BASIC SPOKEN NUMBER DETECTION
  // ============================================================

  const detectWordNumber = (text) => {
    const lower = text.toLowerCase();

    const numberWords = {
      one: 1,
      two: 2,
      three: 3,
      four: 4,
      five: 5,
      six: 6,
      seven: 7,
      eight: 8,
      nine: 9,
      ten: 10,

      एक: 1,
      दो: 2,
      तीन: 3,
      चार: 4,
      पांच: 5,
      पाँच: 5,
      छह: 6,
      सात: 7,
      आठ: 8,
      नौ: 9,
      दस: 10,

      এক: 1,
      দুই: 2,
      তিন: 3,
      চাৰি: 4,
      পাঁচ: 5,
      ছয়: 6,
      সাত: 7,
      আঠ: 8,
      ন: 9,
      দহ: 10,
    };

    for (const [word, number] of Object.entries(
      numberWords
    )) {
      if (lower.includes(word.toLowerCase())) {
        return number;
      }
    }

    return null;
  };

  // ============================================================
  // VOICE INTELLIGENCE
  // ============================================================

  const analyseTranscript = (spokenText) => {
    const normalized =
      normalizeDigits(spokenText);

    const lower =
      normalized.toLowerCase();

    const numberMatch =
      normalized.match(/\d+/);

    let peopleAffected = "";

    if (numberMatch) {
      peopleAffected =
        Number(numberMatch[0]);
    } else {
      const wordNumber =
        detectWordNumber(normalized);

      if (wordNumber !== null) {
        peopleAffected =
          wordNumber;
      }
    }

    const hasAny = (keywords) =>
      keywords.some((keyword) =>
        lower.includes(
          keyword.toLowerCase()
        )
      );

    const diarrhea = hasAny([
      "diarrhea",
      "diarrhoea",
      "loose motion",
      "loose motions",
      "दस्त",
      "डायरिया",
      "जुलाब",
      "ডায়েৰিয়া",
      "ডায়েৰিয়া",
      "পাতল পায়খানা",
    ]);

    const vomiting = hasAny([
      "vomiting",
      "vomit",
      "उल्टी",
      "उल्टियां",
      "उल्टियाँ",
      "বমি",
    ]);

    const fever = hasAny([
      "fever",
      "बुखार",
      "ताप",
      "জ্বৰ",
      "জ্বর",
    ]);

    const jaundice = hasAny([
      "jaundice",
      "पीलिया",
      "कावीळ",
      "জণ্ডিচ",
      "জন্ডিস",
    ]);

    const abdominalPain = hasAny([
      "abdominal pain",
      "stomach pain",
      "stomach ache",
      "पेट दर्द",
      "पेट में दर्द",
      "পেটৰ বিষ",
      "পেট ব্যথা",
    ]);

    setForm((previous) => ({
      ...previous,

      people_affected:
        peopleAffected ||
        previous.people_affected,

      diarrhea:
        diarrhea ||
        previous.diarrhea,

      vomiting:
        vomiting ||
        previous.vomiting,

      fever:
        fever ||
        previous.fever,

      jaundice:
        jaundice ||
        previous.jaundice,

      abdominal_pain:
        abdominalPain ||
        previous.abdominal_pain,
    }));
  };

  // ============================================================
  // START VOICE RECOGNITION
  // ============================================================

  const startListening = () => {
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setMessage(
        "Voice recognition is not supported in this browser. Please use manual reporting."
      );

      return;
    }

    const recognition =
      new SpeechRecognition();

    recognition.lang = language;
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setListening(true);
      setMessage("");
    };

    recognition.onresult = (event) => {
      const spokenText =
        event.results[0][0].transcript;

      setTranscript(spokenText);

      analyseTranscript(spokenText);
    };

    recognition.onerror = (event) => {
      console.error(
        "Speech recognition error:",
        event.error
      );

      setMessage(
        "Voice input could not be recognised. Please try again or use the form."
      );
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognition.start();
  };

  // ============================================================
  // SUBMIT ASHA REPORT
  // ============================================================

  const handleSubmit = async (event) => {
    event.preventDefault();

    setMessage("");

    if (!form.village_id) {
      setMessage(
        "Please select a village."
      );

      return;
    }

    if (
      !form.people_affected ||
      Number(form.people_affected) <= 0
    ) {
      setMessage(
        "Please enter the number of people affected."
      );

      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/symptom-reports`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            village_id:
              Number(form.village_id),

            water_source_id:
              selectedNetwork?.water_source_id
                ? Number(
                    selectedNetwork.water_source_id
                  )
                : null,

            people_affected:
              Number(
                form.people_affected
              ),

            diarrhea:
              form.diarrhea,

            vomiting:
              form.vomiting,

            fever:
              form.fever,

            jaundice:
              form.jaundice,

            abdominal_pain:
              form.abdominal_pain,

            reported_by:
              "ASHA Worker",
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        setMessage(
          data.detail ||
            "Unable to submit health report."
        );

        return;
      }

      setMessage(
        "Health signal submitted successfully. District intelligence can now use this observation."
      );

      setTranscript("");

      setForm((previous) => ({
        ...previous,

        people_affected: "",

        diarrhea: false,
        vomiting: false,
        fever: false,
        jaundice: false,
        abdominal_pain: false,
      }));
    } catch (error) {
      console.error(error);

      setMessage(
        "Could not connect to NeerNayan backend."
      );
    }
  };

  // ============================================================
  // UI
  // ============================================================

  return (
    <div className="app">

      {/* ======================================================
          NAVBAR
      ====================================================== */}

      <nav className="navbar">

        <div className="brand-section">

          <img
            src="/logo.png"
            alt="NeerNayan Logo"
            className="brand-logo"
          />

          <div className="brand-text">
            <h2>NeerNayan</h2>

            <span>
              Community Health Intelligence
            </span>
          </div>

        </div>

        <div className="portal-nav">

          <button
            type="button"
            className={`portal-button ${
              activePortal === "asha"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setActivePortal("asha")
            }
          >
            ASHA Worker
          </button>

          <button
            type="button"
            className={`portal-button ${
              activePortal === "citizen"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setActivePortal("citizen")
            }
          >
            Citizen Report
          </button>

          <button
            type="button"
            className={`portal-button ${
              activePortal === "water"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setActivePortal("water")
            }
          >
            Water Quality
          </button>

          <button
            type="button"
            className={`portal-button ${
              activePortal === "district"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setActivePortal("district")
            }
          >
            District Dashboard
          </button>

        </div>

      </nav>

      {/* ======================================================
          MAIN CONTENT
      ====================================================== */}

      <main className="page">

        {/* ====================================================
            ASHA WORKER PORTAL
        ==================================================== */}

        {activePortal === "asha" && (
          <>
            <section className="intro">
              <p className="eyebrow">
                FRONTLINE HEALTH REPORTING
              </p>

              <h1>
                Early Community Health Signal
              </h1>

              <p>
                ASHA workers can report
                emerging symptoms using a
                simple form or regional-language
                voice input. Reports contribute
                to NeerNayan&apos;s district
                early-warning intelligence.
              </p>
            </section>

            <section className="report-card">

              <form onSubmit={handleSubmit}>

                {/* LANGUAGE */}

                <div className="form-field">
                  <label htmlFor="language">
                    Voice Language
                  </label>

                  <select
                    id="language"
                    value={language}
                    onChange={(event) =>
                      setLanguage(
                        event.target.value
                      )
                    }
                  >
                    <option value="en-IN">
                      English
                    </option>

                    <option value="hi-IN">
                      Hindi
                    </option>

                    <option value="as-IN">
                      Assamese
                    </option>
                  </select>
                </div>

                {/* VILLAGE */}

                <div className="form-field">
                  <label htmlFor="village_id">
                    Village
                  </label>

                  <select
                    id="village_id"
                    name="village_id"
                    value={form.village_id}
                    onChange={handleChange}
                    required
                  >
                    <option value="">
                      Select village
                    </option>

                    {villages.map(
                      (village) => (
                        <option
                          key={village.id}
                          value={village.id}
                        >
                          {village.name}
                          {village.district
                            ? ` — ${village.district}`
                            : ""}
                        </option>
                      )
                    )}
                  </select>
                </div>

                {/* CONNECTED SOURCE */}

                {form.village_id && (
                  <div className="connected-source-box">
                    <span>
                      CONNECTED DRINKING-WATER SOURCE
                    </span>

                    <strong>
                      {selectedNetwork
                        ? `${
                            selectedNetwork.source_code ||
                            ""
                          } ${
                            selectedNetwork.source_name ||
                            "Linked source"
                          }`
                        : "No source relationship available"}
                    </strong>
                  </div>
                )}

                {/* PEOPLE */}

                <div className="form-field">
                  <label htmlFor="people_affected">
                    People Affected
                  </label>

                  <input
                    id="people_affected"
                    name="people_affected"
                    type="number"
                    min="1"
                    value={
                      form.people_affected
                    }
                    onChange={handleChange}
                    placeholder="Example: 5"
                    required
                  />
                </div>

                {/* VOICE */}

                <div className="voice-section">

                  <button
                    type="button"
                    className={`voice-button ${
                      listening
                        ? "listening"
                        : ""
                    }`}
                    onClick={startListening}
                  >
                    {listening
                      ? "● Listening..."
                      : "🎙 Report Symptoms by Voice"}
                  </button>

                  <p className="voice-help">
                    Example: &quot;Five people
                    have diarrhoea, vomiting and
                    fever.&quot; Voice support
                    depends on browser
                    recognition availability.
                  </p>

                  {transcript && (
                    <div className="transcript">
                      <strong>
                        Recognised:
                      </strong>

                      <p>
                        {transcript}
                      </p>
                    </div>
                  )}

                </div>

                {/* SYMPTOMS */}

                <div className="symptoms">

                  <h3>
                    Symptoms Observed
                  </h3>

                  <label className="check">
                    <input
                      type="checkbox"
                      name="diarrhea"
                      checked={
                        form.diarrhea
                      }
                      onChange={
                        handleChange
                      }
                    />

                    Diarrhoea
                  </label>

                  <label className="check">
                    <input
                      type="checkbox"
                      name="vomiting"
                      checked={
                        form.vomiting
                      }
                      onChange={
                        handleChange
                      }
                    />

                    Vomiting
                  </label>

                  <label className="check">
                    <input
                      type="checkbox"
                      name="fever"
                      checked={
                        form.fever
                      }
                      onChange={
                        handleChange
                      }
                    />

                    Fever
                  </label>

                  <label className="check">
                    <input
                      type="checkbox"
                      name="jaundice"
                      checked={
                        form.jaundice
                      }
                      onChange={
                        handleChange
                      }
                    />

                    Jaundice
                  </label>

                  <label className="check">
                    <input
                      type="checkbox"
                      name="abdominal_pain"
                      checked={
                        form.abdominal_pain
                      }
                      onChange={
                        handleChange
                      }
                    />

                    Abdominal Pain
                  </label>

                </div>

                {/* DISCLAIMER */}

                <div className="health-report-note">
                  <strong>
                    Decision-support signal
                  </strong>

                  <p>
                    This report records
                    community-level symptoms for
                    surveillance. It does not
                    represent a medical diagnosis.
                  </p>
                </div>

                {/* MESSAGE */}

                {message && (
                  <div className="message">
                    {message}
                  </div>
                )}

                {/* SUBMIT */}

                <button
                  type="submit"
                  className="submit-button"
                >
                  Submit Health Signal
                </button>

              </form>

            </section>
          </>
        )}

        {/* ====================================================
            CITIZEN PORTAL
        ==================================================== */}

        {activePortal === "citizen" && (
          <CitizenReport />
        )}

        {/* ====================================================
            WATER QUALITY
        ==================================================== */}

        {activePortal === "water" && (
          <WaterQualityForm />
        )}

        {/* ====================================================
            DISTRICT DASHBOARD
        ==================================================== */}

        {activePortal === "district" && (
          <DistrictDashboard />
        )}

      </main>

    </div>
  );
}

export default App;
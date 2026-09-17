import { useEffect, useState } from "react";
import RiskMap from "./RiskMap";
import HistoricalTrends from "./HistoricalTrends";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const WORKFLOW = [
  "Detected",
  "Investigation Started",
  "Water Source Verified",
  "Intervention Taken",
  "Resolved",
  "Outcome Verified",
];

function DistrictDashboard() {
  const [risks, setRisks] = useState([]);
  const [sources, setSources] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [citizenReports, setCitizenReports] = useState([]);
  const [priorities, setPriorities] = useState([]);

  const [villages, setVillages] = useState([]);
  const [waterSources, setWaterSources] = useState([]);
  const [network, setNetwork] = useState([]);
  const [interventions, setInterventions] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  const [outcomeNotes, setOutcomeNotes] = useState({});
  const [lastRefreshed, setLastRefreshed] = useState(null);

  // ============================================================
  // LOAD DASHBOARD
  // ============================================================

  const loadDashboard = async () => {
    setLoading(true);
    setError("");

    try {
      const responses = await Promise.all([
        fetch(`${API_URL}/risk-analysis`),
        fetch(`${API_URL}/probable-sources`),
        fetch(`${API_URL}/exposure-warnings`),
        fetch(`${API_URL}/citizen-reports`),
        fetch(`${API_URL}/intervention-priority`),
        fetch(`${API_URL}/villages`),
        fetch(`${API_URL}/water-sources`),
        fetch(`${API_URL}/network`),
        fetch(`${API_URL}/interventions`),
      ]);

      const failed = responses.some(
        (response) => !response.ok
      );

      if (failed) {
        throw new Error(
          "Unable to load dashboard information."
        );
      }

      const [
        riskData,
        sourceData,
        warningData,
        citizenData,
        priorityData,
        villageData,
        waterSourceData,
        networkData,
        interventionData,
      ] = await Promise.all(
        responses.map((response) => response.json())
      );

      setRisks(riskData);
      setSources(sourceData);
      setWarnings(warningData);
      setCitizenReports(citizenData);
      setPriorities(priorityData);

      setVillages(villageData);
      setWaterSources(waterSourceData);
      setNetwork(networkData);
      setInterventions(interventionData);

      setLastRefreshed(new Date());
    } catch (err) {
      console.error(err);

      setError(
        "Could not load NeerNayan intelligence. Make sure the backend is running."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  // ============================================================
  // RISK HELPERS
  // ============================================================

  const riskClass = (level) => {
    if (level === "Priority") {
      return "risk-priority";
    }

    if (level === "Investigate") {
      return "risk-investigate";
    }

    if (level === "Watch") {
      return "risk-watch";
    }

    return "risk-normal";
  };

  const sortedRisks = [...risks].sort(
    (a, b) =>
      (b.risk_score || 0) -
      (a.risk_score || 0)
  );

  const highRiskCount = risks.filter(
    (item) =>
      item.risk_level === "Priority" ||
      item.risk_level === "Investigate"
  ).length;

  const unverifiedCitizenSignals =
    citizenReports.filter(
      (report) =>
        report.verification_status === "Unverified"
    ).length;

  const activeCases = interventions.filter(
    (item) =>
      item.status !== "Outcome Verified"
  ).length;

  // ============================================================
  // MAIN INTELLIGENCE STORY
  // ============================================================

  const topPriority =
    priorities.length > 0
      ? priorities[0]
      : null;

  const leadSource =
    sources.length > 0
      ? sources[0]
      : null;

  const leadWarning =
    warnings.length > 0
      ? warnings[0]
      : null;

  const visiblePriorities =
    priorities.slice(0, 8);

  // ============================================================
  // INTERVENTION HELPERS
  // ============================================================

  const findInterventionForVillage = (
    villageId
  ) => {
    return interventions.find(
      (item) =>
        Number(item.village_id) ===
          Number(villageId) &&
        item.status !== "Outcome Verified"
    );
  };

  const getWorkflowIndex = (status) => {
    return WORKFLOW.indexOf(status);
  };

  const getNextStatus = (status) => {
    const currentIndex =
      getWorkflowIndex(status);

    if (
      currentIndex === -1 ||
      currentIndex >=
        WORKFLOW.length - 1
    ) {
      return null;
    }

    return WORKFLOW[
      currentIndex + 1
    ];
  };

  const getNextActionLabel = (status) => {
    switch (status) {
      case "Detected":
        return "Start Investigation";

      case "Investigation Started":
        return "Verify Water Source";

      case "Water Source Verified":
        return "Record Intervention";

      case "Intervention Taken":
        return "Mark Resolved";

      case "Resolved":
        return "Verify Outcome";

      default:
        return null;
    }
  };

  // ============================================================
  // CREATE ACTION CASE
  // ============================================================

  const createIntervention = async (
    priority
  ) => {
    setActionMessage("");

    try {
      const response = await fetch(
        `${API_URL}/interventions`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            village_id:
              priority.village_id,

            water_source_id:
              priority.water_source_id ||
              null,

            priority_level:
              priority.priority_level,

            intervention_type:
              "Field Investigation",

            assigned_to:
              "District Response Team",

            action_notes:
              priority.recommended_action,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        setActionMessage(
          data.detail ||
            "Unable to create intervention case."
        );

        return;
      }

      setActionMessage(
        `Action case created for ${data.village}.`
      );

      await loadDashboard();
    } catch (err) {
      console.error(err);

      setActionMessage(
        "Could not connect to intervention service."
      );
    }
  };

  // ============================================================
  // ADVANCE ACTION CASE
  // ============================================================

  const advanceIntervention = async (
    intervention
  ) => {
    const nextStatus =
      getNextStatus(
        intervention.status
      );

    if (!nextStatus) {
      return;
    }

    if (
      nextStatus ===
        "Outcome Verified" &&
      !outcomeNotes[
        intervention.id
      ]?.trim()
    ) {
      setActionMessage(
        "Please enter outcome verification notes before completing the case."
      );

      return;
    }

    setActionMessage("");

    try {
      const response = await fetch(
        `${API_URL}/interventions/${intervention.id}`,
        {
          method: "PUT",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            status: nextStatus,

            assigned_to:
              intervention.assigned_to ||
              "District Response Team",

            action_notes:
              intervention.action_notes,

            outcome_notes:
              nextStatus ===
              "Outcome Verified"
                ? outcomeNotes[
                    intervention.id
                  ]
                : intervention.outcome_notes,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        setActionMessage(
          data.detail ||
            "Unable to update intervention."
        );

        return;
      }

      setActionMessage(
        `Intervention updated to "${data.status}".`
      );

      await loadDashboard();
    } catch (err) {
      console.error(err);

      setActionMessage(
        "Could not update intervention."
      );
    }
  };

  // ============================================================
  // LOADING
  // ============================================================

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-pulse" />
        Loading NeerNayan intelligence...
      </div>
    );
  }

  // ============================================================
  // UI
  // ============================================================

  return (
    <>
      {/* ======================================================
          DASHBOARD HERO
      ====================================================== */}

      <div className="dashboard-hero">
        <div className="dashboard-hero-content">
          <div className="dashboard-kicker-row">
            <span className="dashboard-kicker">
              DISTRICT HEALTH INTELLIGENCE
            </span>

            <span className="prototype-badge">
              Prototype · Hybrid Data
            </span>
          </div>

          <h1>
            Water-Borne Disease
            Early-Warning Command Center
          </h1>

          <p>
            NeerNayan combines community
            health signals, drinking-water
            quality, rainfall and shared-source
            relationships to explain risk,
            trace probable sources and guide
            intervention.
          </p>

          <div className="hero-flow">
            <span>Detect</span>
            <b>→</b>
            <span>Trace</span>
            <b>→</b>
            <span>Warn</span>
            <b>→</b>
            <span>Prioritize</span>
            <b>→</b>
            <span>Act</span>
            <b>→</b>
            <span>Verify</span>
          </div>
        </div>

        <div className="dashboard-hero-actions">
          <button
            type="button"
            className="refresh-button"
            onClick={loadDashboard}
          >
            ↻ Refresh Intelligence
          </button>

          {lastRefreshed && (
            <small>
              Updated{" "}
              {lastRefreshed.toLocaleTimeString(
                "en-IN",
                {
                  hour: "2-digit",
                  minute: "2-digit",
                }
              )}
            </small>
          )}
        </div>
      </div>

      {error && (
        <div className="dashboard-error">
          {error}
        </div>
      )}

      {actionMessage && (
        <div className="dashboard-action-message">
          ✓ {actionMessage}
        </div>
      )}

      {/* ======================================================
          SUMMARY STATS
      ====================================================== */}

      <div className="dashboard-stats">
        <div className="stat-card">
          <div className="stat-icon">
            ◉
          </div>

          <div>
            <span>
              Villages Monitored
            </span>

            <strong>
              {risks.length}
            </strong>

            <small>
              Meghalaya communities
            </small>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon stat-icon-warning">
            !
          </div>

          <div>
            <span>
              Investigate
            </span>

            <strong>
              {highRiskCount}
            </strong>

            <small>
              Elevated risk villages
            </small>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon stat-icon-source">
            ≋
          </div>

          <div>
            <span>
              Probable Sources
            </span>

            <strong>
              {sources.length}
            </strong>

            <small>
              Source-attribution signals
            </small>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon stat-icon-case">
            ✓
          </div>

          <div>
            <span>
              Active Action Cases
            </span>

            <strong>
              {activeCases}
            </strong>

            <small>
              Response workflow
            </small>
          </div>
        </div>
      </div>

      {/* ======================================================
          OPERATIONAL INTELLIGENCE STORY
      ====================================================== */}

      <section className="dashboard-section intelligence-brief-section">
        <div className="section-heading">
          <div>
            <p className="section-label">
              LIVE DECISION BRIEF
            </p>

            <h2>
              What Needs Attention Right Now?
            </h2>
          </div>
        </div>

        <div className="intelligence-brief-grid">
          {/* TOP PRIORITY */}

          <div className="brief-card brief-risk">
            <span className="brief-number">
              01
            </span>

            <p className="brief-label">
              HIGHEST PRIORITY
            </p>

            {topPriority ? (
              <>
                <h3>
                  {topPriority.village}
                </h3>

                <div className="brief-score">
                  <strong>
                    {
                      topPriority.priority_score
                    }
                  </strong>
                  <span>/100 priority</span>
                </div>

                <p>
                  {
                    topPriority.recommended_action
                  }
                </p>
              </>
            ) : (
              <p>
                No elevated priority detected.
              </p>
            )}
          </div>

          {/* SOURCE */}

          <div className="brief-card brief-source">
            <span className="brief-number">
              02
            </span>

            <p className="brief-label">
              PROBABLE SOURCE
            </p>

            {leadSource ? (
              <>
                <h3>
                  {leadSource.source_code}
                  {" · "}
                  {leadSource.source_name}
                </h3>

                <span className="brief-evidence">
                  {
                    leadSource.evidence_strength
                  }{" "}
                  evidence
                </span>

                <p>
                  Connected elevated villages:{" "}
                  <strong>
                    {Array.isArray(
                      leadSource.affected_villages
                    )
                      ? leadSource.affected_villages.join(
                          ", "
                        )
                      : leadSource.affected_villages}
                  </strong>
                </p>
              </>
            ) : (
              <p>
                No probable source detected.
              </p>
            )}
          </div>

          {/* EXPOSURE */}

          <div className="brief-card brief-exposure">
            <span className="brief-number">
              03
            </span>

            <p className="brief-label">
              PREVENTIVE EXPOSURE
            </p>

            {leadWarning ? (
              <>
                <h3>
                  {leadWarning.village}
                </h3>

                <span className="brief-warning">
                  Early verification recommended
                </span>

                <p>
                  Connected through{" "}
                  <strong>
                    {
                      leadWarning.water_source
                    }
                  </strong>{" "}
                  but currently below the
                  elevated-cluster threshold.
                </p>
              </>
            ) : (
              <p>
                No connected preventive warning
                detected.
              </p>
            )}
          </div>
        </div>

        <div className="decision-explanation">
          <strong>
            Why this matters:
          </strong>

          <span>
            Most dashboards stop at
            &quot;where is risk?&quot; NeerNayan
            additionally shows a probable shared
            source, connected communities that may
            require preventive verification, and
            where authorities should act first.
          </span>
        </div>
      </section>

      {/* ======================================================
          GOVERNMENT PRIORITY
      ====================================================== */}

      <section className="dashboard-section">
        <div className="section-heading section-heading-row">
          <div>
            <p className="section-label">
              GOVERNMENT ACTION PRIORITY
            </p>

            <h2>
              Where Should We Act First?
            </h2>

            <p className="section-subtitle">
              Ranked using health risk,
              water-quality evidence, connected
              exposure and community signals.
            </p>
          </div>

          <span className="section-count">
            Top {visiblePriorities.length}
          </span>
        </div>

        {visiblePriorities.length === 0 ? (
          <div className="empty-state">
            No intervention priorities
            currently available.
          </div>
        ) : (
          <div className="priority-list">
            {visiblePriorities.map(
              (item, index) => {
                const existingIntervention =
                  findInterventionForVillage(
                    item.village_id
                  );

                return (
                  <div
                    className={`priority-card priority-${item.priority_level.toLowerCase()}`}
                    key={item.village_id}
                  >
                    <div className="priority-rank">
                      #{index + 1}
                    </div>

                    <div className="priority-main">
                      <div className="priority-heading">
                        <div>
                          <h3>
                            {item.village}
                          </h3>

                          <span>
                            Risk score{" "}
                            {item.risk_score}/100
                          </span>
                        </div>

                        <div className="priority-score-box">
                          <strong>
                            {
                              item.priority_score
                            }
                          </strong>

                          <span>
                            PRIORITY
                          </span>
                        </div>
                      </div>

                      <div className="priority-signals">
                        <span>
                          Risk{" "}
                          <strong>
                            {
                              item.risk_level
                            }
                          </strong>
                        </span>

                        <span>
                          Citizen signals{" "}
                          <strong>
                            {
                              item.citizen_signals
                            }
                          </strong>
                        </span>

                        <span>
                          Exposure{" "}
                          <strong>
                            {item.exposure_warning
                              ? "Flagged"
                              : "No"}
                          </strong>
                        </span>
                      </div>

                      <div className="priority-action">
                        <span>
                          RECOMMENDED RESPONSE
                        </span>

                        <p>
                          {
                            item.recommended_action
                          }
                        </p>
                      </div>

                      {existingIntervention ? (
                        <div className="case-open-indicator">
                          <span className="case-live-dot" />

                          Action case active —{" "}
                          <strong>
                            {
                              existingIntervention.status
                            }
                          </strong>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="open-case-button"
                          onClick={() =>
                            createIntervention(
                              item
                            )
                          }
                        >
                          Open Action Case →
                        </button>
                      )}
                    </div>

                    <div
                      className={`priority-level-badge level-${item.priority_level.toLowerCase()}`}
                    >
                      {item.priority_level}
                    </div>
                  </div>
                );
              }
            )}
          </div>
        )}
      </section>

      {/* ======================================================
          MAP
      ====================================================== */}

      <section className="dashboard-section feature-section">
        <div className="section-heading">
          <p className="section-label">
            GEOSPATIAL INTELLIGENCE
          </p>

          <h2>
            Source & Risk Intelligence Map
          </h2>

          <p className="section-subtitle">
            Risk intensity is visualized together
            with drinking-water sources,
            source-to-village relationships and
            preventive exposure warnings.
          </p>
        </div>

        <RiskMap
          villages={villages}
          waterSources={waterSources}
          network={network}
          risks={risks}
          probableSources={sources}
          warnings={warnings}
        />
      </section>

      {/* ======================================================
          SOURCE ATTRIBUTION
      ====================================================== */}

      <section className="dashboard-section">
        <div className="section-heading">
          <p className="section-label">
            PROBABLE SOURCE ATTRIBUTION
          </p>

          <h2>
            Why Is This Cluster Emerging?
          </h2>

          <p className="section-subtitle">
            NeerNayan checks whether elevated
            health signals occur among communities
            connected to the same drinking-water
            source alongside water-quality
            evidence.
          </p>
        </div>

        {sources.length === 0 ? (
          <div className="empty-state">
            No probable contamination source
            currently detected.
          </div>
        ) : (
          <div className="source-grid">
            {sources.map(
              (source, index) => (
                <div
                  className="source-alert-card"
                  key={`${source.source_code}-${index}`}
                >
                  <div className="source-top">
                    <div>
                      <span className="source-code">
                        {
                          source.source_code
                        }
                      </span>

                      <h3>
                        {
                          source.source_name
                        }
                      </h3>
                    </div>

                    <span className="evidence-badge">
                      {
                        source.evidence_strength
                      }{" "}
                      Evidence
                    </span>
                  </div>

                  <div className="source-metric-row">
                    <div>
                      <span>
                        Connected villages
                      </span>

                      <strong>
                        {
                          source.connected_villages
                        }
                      </strong>
                    </div>

                    <div>
                      <span>
                        Water evidence
                      </span>

                      <strong>
                        {
                          source.water_evidence_score
                        }
                        /30
                      </strong>
                    </div>
                  </div>

                  <div className="source-detail">
                    <span>
                      ELEVATED COMMUNITIES
                    </span>

                    <strong>
                      {Array.isArray(
                        source.affected_villages
                      )
                        ? source.affected_villages.join(
                            " · "
                          )
                        : source.affected_villages}
                    </strong>
                  </div>

                  <div className="source-reason">
                    <span>
                      WHY FLAGGED
                    </span>

                    <p>
                      {source.reason}
                    </p>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </section>

      {/* ======================================================
          EXPOSURE WARNINGS
      ====================================================== */}

      <section className="dashboard-section">
        <div className="section-heading">
          <p className="section-label">
            PREVENTIVE INTELLIGENCE
          </p>

          <h2>
            Who May Need Verification Next?
          </h2>

          <p className="section-subtitle">
            These are connected communities that
            share a probable source but currently
            show a lower aligned health signal.
          </p>
        </div>

        {warnings.length === 0 ? (
          <div className="empty-state">
            No preventive exposure warning
            currently detected.
          </div>
        ) : (
          <div className="warning-grid">
            {warnings.map(
              (warning, index) => (
                <div
                  className="exposure-card"
                  key={`${warning.village}-${index}`}
                >
                  <div className="warning-icon">
                    !
                  </div>

                  <div className="warning-content">
                    <span className="warning-label">
                      PREVENTIVE VERIFICATION
                    </span>

                    <h3>
                      {warning.village}
                    </h3>

                    <p>
                      {warning.warning}
                    </p>

                    <div className="warning-meta">
                      <span>
                        Shared source
                      </span>

                      <strong>
                        {
                          warning.water_source
                        }
                      </strong>
                    </div>

                    <div className="warning-action">
                      <strong>
                        Recommended:
                      </strong>{" "}
                      {
                        warning.recommended_action
                      }
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </section>

      {/* ======================================================
          HISTORICAL TRENDS
      ====================================================== */}

      <section className="dashboard-section feature-section">
        <div className="section-heading">
          <p className="section-label">
            TEMPORAL INTELLIGENCE
          </p>

          <h2>
            Historical Risk & Outbreak Trends
          </h2>

          <p className="section-subtitle">
            Compare historical health,
            water-quality and rainfall/flood
            observations for each monitored
            community.
          </p>
        </div>

        <HistoricalTrends
          villages={villages}
        />
      </section>

      {/* ======================================================
          INTERVENTION TRACKING
      ====================================================== */}

      <section className="dashboard-section">
        <div className="section-heading">
          <p className="section-label">
            CLOSED-LOOP GOVERNANCE
          </p>

          <h2>
            Intervention & Outcome Tracking
          </h2>

          <p className="section-subtitle">
            An early-warning system should not
            stop after an alert. NeerNayan tracks
            the response until the outcome is
            verified.
          </p>
        </div>

        {interventions.length === 0 ? (
          <div className="empty-state">
            No intervention cases have been
            opened yet.
          </div>
        ) : (
          <div className="intervention-list">
            {interventions.map(
              (intervention) => {
                const currentIndex =
                  getWorkflowIndex(
                    intervention.status
                  );

                const nextLabel =
                  getNextActionLabel(
                    intervention.status
                  );

                return (
                  <div
                    className="intervention-card"
                    key={intervention.id}
                  >
                    <div className="intervention-card-header">
                      <div>
                        <span className="case-id">
                          RESPONSE CASE #
                          {intervention.id}
                        </span>

                        <h3>
                          {
                            intervention.village
                          }
                        </h3>

                        <p>
                          {intervention.water_source
                            ? `Linked source · ${intervention.water_source}`
                            : "No linked source"}
                        </p>
                      </div>

                      <span className="intervention-status">
                        {
                          intervention.status
                        }
                      </span>
                    </div>

                    <div className="workflow-track">
                      {WORKFLOW.map(
                        (step, index) => (
                          <div
                            key={step}
                            className={`workflow-step ${
                              index <=
                              currentIndex
                                ? "workflow-complete"
                                : ""
                            }`}
                          >
                            <div className="workflow-dot">
                              {index <
                              currentIndex
                                ? "✓"
                                : index + 1}
                            </div>

                            <span>
                              {step}
                            </span>
                          </div>
                        )
                      )}
                    </div>

                    <div className="intervention-details">
                      <div>
                        <span>
                          PRIORITY
                        </span>

                        <strong>
                          {
                            intervention.priority_level
                          }
                        </strong>
                      </div>

                      <div>
                        <span>
                          RESPONSE TYPE
                        </span>

                        <strong>
                          {
                            intervention.intervention_type
                          }
                        </strong>
                      </div>

                      <div>
                        <span>
                          ASSIGNED TEAM
                        </span>

                        <strong>
                          {intervention.assigned_to ||
                            "Not assigned"}
                        </strong>
                      </div>
                    </div>

                    {intervention.action_notes && (
                      <div className="intervention-note">
                        <span>
                          ACTION PLAN
                        </span>

                        <p>
                          {
                            intervention.action_notes
                          }
                        </p>
                      </div>
                    )}

                    {intervention.outcome_notes && (
                      <div className="outcome-note">
                        <span>
                          VERIFIED OUTCOME
                        </span>

                        <p>
                          {
                            intervention.outcome_notes
                          }
                        </p>
                      </div>
                    )}

                    {intervention.status ===
                      "Resolved" && (
                      <div className="outcome-input">
                        <label>
                          Outcome verification
                          notes
                        </label>

                        <textarea
                          value={
                            outcomeNotes[
                              intervention.id
                            ] || ""
                          }
                          onChange={(
                            event
                          ) =>
                            setOutcomeNotes(
                              (previous) => ({
                                ...previous,

                                [intervention.id]:
                                  event.target
                                    .value,
                              })
                            )
                          }
                          placeholder="Example: Follow-up water test completed and no additional community cases reported during monitoring."
                        />
                      </div>
                    )}

                    {nextLabel && (
                      <button
                        type="button"
                        className="advance-button"
                        onClick={() =>
                          advanceIntervention(
                            intervention
                          )
                        }
                      >
                        {nextLabel} →
                      </button>
                    )}

                    {intervention.status ===
                      "Outcome Verified" && (
                      <div className="verified-case">
                        ✓ Response cycle completed
                        and outcome verified.
                      </div>
                    )}
                  </div>
                );
              }
            )}
          </div>
        )}
      </section>

      {/* ======================================================
          EXPLAINABLE RISK
      ====================================================== */}

      <section className="dashboard-section">
        <div className="section-heading">
          <p className="section-label">
            EXPLAINABLE SCORING
          </p>

          <h2>
            Why Is Each Village at Risk?
          </h2>

          <p className="section-subtitle">
            Every score is broken into visible
            evidence components rather than
            presenting an unexplained prediction.
          </p>
        </div>

        <div className="risk-table-wrapper">
          <table className="risk-table">
            <thead>
              <tr>
                <th>Village</th>
                <th>Score</th>
                <th>Status</th>
                <th>Health</th>
                <th>Water</th>
                <th>Shared Source</th>
                <th>Rainfall</th>
              </tr>
            </thead>

            <tbody>
              {sortedRisks.map(
                (risk) => (
                  <tr
                    key={
                      risk.village_id
                    }
                  >
                    <td>
                      <strong>
                        {
                          risk.village
                        }
                      </strong>
                    </td>

                    <td>
                      <span className="score-number">
                        {
                          risk.risk_score
                        }
                      </span>
                      /100
                    </td>

                    <td>
                      <span
                        className={`risk-badge ${riskClass(
                          risk.risk_level
                        )}`}
                      >
                        {
                          risk.risk_level
                        }
                      </span>
                    </td>

                    <td>
                      {risk.evidence
                        ?.health ?? 0}
                    </td>

                    <td>
                      {risk.evidence
                        ?.water ?? 0}
                    </td>

                    <td>
                      {risk.evidence
                        ?.shared ?? 0}
                    </td>

                    <td>
                      {risk.evidence
                        ?.rainfall ?? 0}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>

        <div className="evidence-formula">
          <div>
            <strong>40</strong>
            <span>Health</span>
          </div>

          <b>+</b>

          <div>
            <strong>30</strong>
            <span>Water</span>
          </div>

          <b>+</b>

          <div>
            <strong>20</strong>
            <span>Shared Source</span>
          </div>

          <b>+</b>

          <div>
            <strong>10</strong>
            <span>Rainfall / Flood</span>
          </div>

          <b>=</b>

          <div className="formula-total">
            <strong>100</strong>
            <span>Risk Score</span>
          </div>
        </div>
      </section>

      {/* ======================================================
          CITIZEN SIGNALS
      ====================================================== */}

      <section className="dashboard-section">
        <div className="section-heading">
          <p className="section-label">
            COMMUNITY SIGNALS
          </p>

          <h2>
            Citizen Reports Awaiting
            Verification
          </h2>

          <p className="section-subtitle">
            Citizen reports are weak
            early-warning signals and remain
            explicitly unverified until reviewed
            by a health worker.
          </p>
        </div>

        {citizenReports.length === 0 ? (
          <div className="empty-state">
            No unverified citizen reports
            currently stored.
          </div>
        ) : (
          <div className="citizen-signal-grid">
            {citizenReports
              .slice(0, 6)
              .map((report) => (
                <div
                  className="citizen-signal-card"
                  key={report.id}
                >
                  <div className="citizen-signal-top">
                    <div>
                      <span className="community-label">
                        COMMUNITY SIGNAL
                      </span>

                      <h3>
                        {
                          report.village
                        }
                      </h3>
                    </div>

                    <span className="unverified-badge">
                      {
                        report.verification_status
                      }
                    </span>
                  </div>

                  <p>
                    <strong>
                      {
                        report.people_affected
                      }
                    </strong>{" "}
                    {report.people_affected ===
                    1
                      ? "person"
                      : "people"}{" "}
                    reporting symptoms
                  </p>

                  <div className="signal-tags">
                    {report.diarrhea && (
                      <span>
                        Diarrhoea
                      </span>
                    )}

                    {report.vomiting && (
                      <span>
                        Vomiting
                      </span>
                    )}

                    {report.fever && (
                      <span>
                        Fever
                      </span>
                    )}

                    {report.jaundice && (
                      <span>
                        Jaundice
                      </span>
                    )}

                    {report.abdominal_pain && (
                      <span>
                        Abdominal pain
                      </span>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}
      </section>

      {/* ======================================================
          DATA TRANSPARENCY
      ====================================================== */}

      <div className="dashboard-data-note">
        <div className="data-note-icon">
          i
        </div>

        <div>
          <strong>
            Prototype Data Transparency
          </strong>

          <p>
            This demonstration combines
            geographic/reference information
            with illustrative epidemiological
            and environmental observations.
            Illustrative records are used for
            prototype validation and should not
            be interpreted as official
            village-level public-health
            measurements.
          </p>
        </div>
      </div>
    </>
  );
}

export default DistrictDashboard;
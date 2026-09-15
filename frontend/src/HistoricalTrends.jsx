import { useEffect, useState } from "react";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

const API_URL = "http://127.0.0.1:8000";


function HistoricalTrends({ villages }) {
  const [selectedVillage, setSelectedVillage] =
    useState("");

  const [trendData, setTrendData] =
    useState(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");


  // ============================================================
  // SELECT FIRST VILLAGE
  // ============================================================

  useEffect(() => {
    if (
      villages.length > 0 &&
      !selectedVillage
    ) {
      setSelectedVillage(
        String(villages[0].id)
      );
    }
  }, [
    villages,
    selectedVillage,
  ]);


  // ============================================================
  // LOAD HISTORICAL DATA
  // ============================================================

  useEffect(() => {
    if (!selectedVillage) {
      return;
    }

    const loadHistoricalData =
      async () => {

        setLoading(true);
        setError("");

        try {
          const response = await fetch(
            `${API_URL}/historical-trends?village_id=${selectedVillage}`
          );

          const data =
            await response.json();

          if (!response.ok) {
            throw new Error(
              data.detail ||
              "Unable to load historical trends."
            );
          }

          setTrendData(data);

        } catch (err) {

          console.error(err);

          setError(
            "Could not load historical intelligence."
          );

        } finally {

          setLoading(false);

        }
      };

    loadHistoricalData();

  }, [selectedVillage]);


  // ============================================================
  // FORMAT DATE
  // ============================================================

  const formatDate = (date) => {

    if (!date) {
      return "";
    }

    const parsedDate =
      new Date(date);

    return parsedDate.toLocaleDateString(
      "en-IN",
      {
        month: "short",
        year: "numeric",
      }
    );
  };


  // ============================================================
  // CUSTOM TOOLTIP DATE
  // ============================================================

  const tooltipLabelFormatter =
    (value) => {

      if (!value) {
        return "";
      }

      const parsedDate =
        new Date(value);

      return parsedDate.toLocaleDateString(
        "en-IN",
        {
          day: "numeric",
          month: "short",
          year: "numeric",
        }
      );
    };


  // ============================================================
  // EMPTY
  // ============================================================

  if (villages.length === 0) {

    return (
      <div className="empty-state">
        No village data available for
        historical analysis.
      </div>
    );
  }


  // ============================================================
  // UI
  // ============================================================

  return (
    <div className="historical-intelligence">

      {/* ======================================================
          VILLAGE SELECTOR
      ====================================================== */}

      <div className="trend-controls">

        <div>
          <span className="trend-control-label">
            SELECT MONITORED VILLAGE
          </span>

          <select
            value={selectedVillage}
            onChange={(event) =>
              setSelectedVillage(
                event.target.value
              )
            }
          >
            {villages.map(
              (village) => (
                <option
                  key={village.id}
                  value={village.id}
                >
                  {village.name}
                  {" — "}
                  {village.district}
                </option>
              )
            )}
          </select>
        </div>

        {trendData && (
          <div className="trend-location-summary">

            <div>
              <span>
                Population
              </span>

              <strong>
                {trendData.village
                  ?.population
                  ?.toLocaleString(
                    "en-IN"
                  ) || "N/A"}
              </strong>
            </div>

            <div>
              <span>
                Water Source
              </span>

              <strong>
                {trendData.water_source
                  ?.source_code ||
                  "Not linked"}
              </strong>
            </div>

            <div>
              <span>
                Source Type
              </span>

              <strong>
                {trendData.water_source
                  ?.source_type ||
                  "Unknown"}
              </strong>
            </div>

          </div>
        )}

      </div>


      {/* ======================================================
          LOADING / ERROR
      ====================================================== */}

      {loading && (
        <div className="trend-loading">
          Loading historical intelligence...
        </div>
      )}

      {error && (
        <div className="dashboard-error">
          {error}
        </div>
      )}


      {trendData && !loading && (

        <>
          {/* ==================================================
              DATA COVERAGE
          ================================================== */}

          <div className="trend-record-summary">

            <div>
              <span>
                Health Records
              </span>

              <strong>
                {
                  trendData.record_counts
                    .health
                }
              </strong>
            </div>

            <div>
              <span>
                Water Tests
              </span>

              <strong>
                {
                  trendData.record_counts
                    .water
                }
              </strong>
            </div>

            <div>
              <span>
                Rainfall Records
              </span>

              <strong>
                {
                  trendData.record_counts
                    .rainfall
                }
              </strong>
            </div>

          </div>


          {/* ==================================================
              HEALTH TREND
          ================================================== */}

          <div className="trend-chart-card">

            <div className="trend-chart-heading">

              <div>
                <span>
                  COMMUNITY HEALTH SIGNAL
                </span>

                <h3>
                  Water-Borne Disease Case Trend
                </h3>
              </div>

              <div className="chart-indicator health-indicator">
                Cases over time
              </div>

            </div>

            {trendData.health_trend
              .length === 0 ? (

              <div className="trend-no-data">
                No historical health records
                available for this village.
              </div>

            ) : (

              <div className="chart-container">

                <ResponsiveContainer
                  width="100%"
                  height={300}
                >
                  <LineChart
                    data={
                      trendData.health_trend
                    }
                    margin={{
                      top: 10,
                      right: 20,
                      left: 0,
                      bottom: 5,
                    }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                    />

                    <XAxis
                      dataKey="date"
                      tickFormatter={
                        formatDate
                      }
                    />

                    <YAxis />

                    <Tooltip
                      labelFormatter={
                        tooltipLabelFormatter
                      }
                    />

                    <Legend />

                    <Line
                      type="monotone"
                      dataKey="cases"
                      name="Cases"
                      stroke="#c55c4f"
                      strokeWidth={3}
                      activeDot={{
                        r: 6,
                      }}
                    />

                    <Line
                      type="monotone"
                      dataKey="health_risk"
                      name="Health Risk Score"
                      stroke="#e49b3b"
                      strokeWidth={2}
                    />

                  </LineChart>
                </ResponsiveContainer>

              </div>
            )}

          </div>


          {/* ==================================================
              WATER QUALITY TREND
          ================================================== */}

          <div className="trend-chart-card">

            <div className="trend-chart-heading">

              <div>
                <span>
                  WATER SOURCE INTELLIGENCE
                </span>

                <h3>
                  Water Quality Risk Trend
                </h3>
              </div>

              <div className="chart-indicator water-indicator">
                Source evidence
              </div>

            </div>

            {trendData.water_trend
              .length === 0 ? (

              <div className="trend-no-data">
                No historical water-quality
                records available.
              </div>

            ) : (

              <div className="chart-container">

                <ResponsiveContainer
                  width="100%"
                  height={300}
                >
                  <LineChart
                    data={
                      trendData.water_trend
                    }
                    margin={{
                      top: 10,
                      right: 20,
                      left: 0,
                      bottom: 5,
                    }}
                  >

                    <CartesianGrid
                      strokeDasharray="3 3"
                    />

                    <XAxis
                      dataKey="date"
                      tickFormatter={
                        formatDate
                      }
                    />

                    <YAxis
                      domain={[0, 30]}
                    />

                    <Tooltip
                      labelFormatter={
                        tooltipLabelFormatter
                      }
                    />

                    <Legend />

                    <Line
                      type="monotone"
                      dataKey="water_risk"
                      name="Water Risk Score"
                      stroke="#278aaa"
                      strokeWidth={3}
                    />

                  </LineChart>
                </ResponsiveContainer>

              </div>
            )}


            {trendData.water_source && (

              <div className="trend-source-box">

                <span>
                  MONITORED SOURCE
                </span>

                <strong>
                  {
                    trendData.water_source
                      .source_code
                  }
                  {" — "}
                  {
                    trendData.water_source
                      .source_name
                  }
                </strong>

              </div>

            )}

          </div>


          {/* ==================================================
              RAINFALL / FLOOD TREND
          ================================================== */}

          <div className="trend-chart-card">

            <div className="trend-chart-heading">

              <div>
                <span>
                  ENVIRONMENTAL SIGNAL
                </span>

                <h3>
                  Rainfall & Flood Risk Trend
                </h3>
              </div>

              <div className="chart-indicator rainfall-indicator">
                Rainfall exposure
              </div>

            </div>

            {trendData.rainfall_trend
              .length === 0 ? (

              <div className="trend-no-data">
                No historical rainfall or
                flood records available.
              </div>

            ) : (

              <div className="chart-container">

                <ResponsiveContainer
                  width="100%"
                  height={300}
                >

                  <BarChart
                    data={
                      trendData.rainfall_trend
                    }
                    margin={{
                      top: 10,
                      right: 20,
                      left: 0,
                      bottom: 5,
                    }}
                  >

                    <CartesianGrid
                      strokeDasharray="3 3"
                    />

                    <XAxis
                      dataKey="date"
                      tickFormatter={
                        formatDate
                      }
                    />

                    <YAxis />

                    <Tooltip
                      labelFormatter={
                        tooltipLabelFormatter
                      }
                    />

                    <Legend />

                    <Bar
                      dataKey="rainfall_mm"
                      name="Rainfall (mm)"
                      fill="#4c8ca3"
                      radius={[
                        5,
                        5,
                        0,
                        0,
                      ]}
                    />

                  </BarChart>

                </ResponsiveContainer>

              </div>
            )}

          </div>


          {/* ==================================================
              INTERPRETATION
          ================================================== */}

          <div className="trend-intelligence-note">

            <strong>
              How NeerNayan uses this:
            </strong>

            <p>
              Historical signals help authorities
              examine whether increased rainfall,
              changing water quality and rising
              community health cases occur during
              similar monitoring periods. These
              relationships support early-warning
              decisions but do not by themselves
              prove causation.
            </p>

          </div>


          {/* ==================================================
              DATA DISCLAIMER
          ================================================== */}

          <div className="historical-data-note">

            <strong>
              Prototype Data Note
            </strong>

            <p>
              {
                trendData.data_note
              }
            </p>

          </div>

        </>
      )}

    </div>
  );
}


export default HistoricalTrends;
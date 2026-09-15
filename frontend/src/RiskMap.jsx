import { useEffect, useMemo, useState } from "react";

import {
  MapContainer,
  TileLayer,
  Circle,
  CircleMarker,
  Polyline,
  Popup,
  LayersControl,
  Rectangle,
} from "react-leaflet";

import "leaflet/dist/leaflet.css";


// ============================================================
// MEGHALAYA / NORTHEAST DEMO BOUNDS
// Used as geographic reference when map tiles are unavailable.
// ============================================================

const OFFLINE_BOUNDS = [
  [24.9, 89.5],
  [26.4, 92.9],
];


// ============================================================
// HELPERS
// ============================================================

function getLatitude(item) {
  if (!item) return null;

  const value =
    item.latitude ??
    item.lat ??
    null;

  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}


function getLongitude(item) {
  if (!item) return null;

  const value =
    item.longitude ??
    item.lon ??
    item.lng ??
    item.long ??
    null;

  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}


function hasCoordinates(item) {
  return (
    getLatitude(item) !== null &&
    getLongitude(item) !== null
  );
}


function getRiskColor(level) {
  switch (level) {
    case "Priority":
      return "#c94b40";

    case "Investigate":
      return "#e28a36";

    case "Watch":
      return "#d5b53c";

    default:
      return "#43946c";
  }
}


function getRiskFillOpacity(score) {
  const value =
    Number(score) || 0;

  if (value >= 75) return 0.34;
  if (value >= 50) return 0.27;
  if (value >= 30) return 0.20;

  return 0.14;
}


function RiskMap({
  villages = [],
  waterSources = [],
  network = [],
  risks = [],
  probableSources = [],
  warnings = [],
}) {
  const [isOnline, setIsOnline] =
    useState(
      typeof navigator === "undefined"
        ? true
        : navigator.onLine
    );

  const [tileFailure, setTileFailure] =
    useState(false);


  // ==========================================================
  // ONLINE / OFFLINE DETECTION
  // ==========================================================

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setTileFailure(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener(
      "online",
      handleOnline
    );

    window.addEventListener(
      "offline",
      handleOffline
    );

    return () => {
      window.removeEventListener(
        "online",
        handleOnline
      );

      window.removeEventListener(
        "offline",
        handleOffline
      );
    };
  }, []);


  const useOnlineTiles =
    isOnline && !tileFailure;


  // ==========================================================
  // LOOKUP TABLES
  // ==========================================================

  const villageById = useMemo(() => {
    const lookup = {};

    villages.forEach((village) => {
      lookup[Number(village.id)] =
        village;
    });

    return lookup;
  }, [villages]);


  const villageByName = useMemo(() => {
    const lookup = {};

    villages.forEach((village) => {
      if (village.name) {
        lookup[
          village.name.toLowerCase()
        ] = village;
      }
    });

    return lookup;
  }, [villages]);


  const sourceById = useMemo(() => {
    const lookup = {};

    waterSources.forEach((source) => {
      lookup[Number(source.id)] =
        source;
    });

    return lookup;
  }, [waterSources]);


  const riskByVillageId =
    useMemo(() => {
      const lookup = {};

      risks.forEach((risk) => {
        lookup[
          Number(risk.village_id)
        ] = risk;
      });

      return lookup;
    }, [risks]);


  const probableSourceIds =
    useMemo(() => {
      return new Set(
        probableSources
          .map((source) =>
            Number(
              source.water_source_id
            )
          )
          .filter(
            (id) =>
              Number.isFinite(id)
          )
      );
    }, [probableSources]);


  const warningVillageIds =
    useMemo(() => {
      const ids = new Set();

      warnings.forEach((warning) => {
        if (warning.village_id) {
          ids.add(
            Number(
              warning.village_id
            )
          );

          return;
        }

        if (warning.village) {
          const village =
            villageByName[
              warning.village.toLowerCase()
            ];

          if (village) {
            ids.add(
              Number(village.id)
            );
          }
        }
      });

      return ids;
    }, [
      warnings,
      villageByName,
    ]);


  // ==========================================================
  // MAP CENTER
  // ==========================================================

  const validVillages =
    useMemo(
      () =>
        villages.filter(
          hasCoordinates
        ),
      [villages]
    );


  const mapCenter =
    useMemo(() => {
      if (
        validVillages.length === 0
      ) {
        return [25.55, 91.35];
      }

      const latitude =
        validVillages.reduce(
          (sum, village) =>
            sum +
            getLatitude(village),
          0
        ) /
        validVillages.length;

      const longitude =
        validVillages.reduce(
          (sum, village) =>
            sum +
            getLongitude(village),
          0
        ) /
        validVillages.length;

      return [
        latitude,
        longitude,
      ];
    }, [validVillages]);


  // ==========================================================
  // NETWORK CONNECTIONS
  // ==========================================================

  const connections =
    useMemo(() => {
      return network
        .map((link, index) => {
          const village =
            villageById[
              Number(
                link.village_id
              )
            ];

          const source =
            sourceById[
              Number(
                link.water_source_id
              )
            ];

          if (
            !village ||
            !source ||
            !hasCoordinates(village) ||
            !hasCoordinates(source)
          ) {
            return null;
          }

          return {
            id:
              link.id ??
              `${link.village_id}-${link.water_source_id}-${index}`,

            village,

            source,

            positions: [
              [
                getLatitude(source),
                getLongitude(source),
              ],

              [
                getLatitude(village),
                getLongitude(village),
              ],
            ],

            probable:
              probableSourceIds.has(
                Number(source.id)
              ),
          };
        })
        .filter(Boolean);
    }, [
      network,
      villageById,
      sourceById,
      probableSourceIds,
    ]);


  // ==========================================================
  // EMPTY MAP
  // ==========================================================

  if (
    validVillages.length === 0
  ) {
    return (
      <div className="empty-state">
        No valid village coordinates
        are available for map
        visualisation.
      </div>
    );
  }


  // ==========================================================
  // UI
  // ==========================================================

  return (
    <div className="map-shell">

      {/* ======================================================
          MAP INFORMATION
      ====================================================== */}

      <div className="map-information-bar">

        <div>
          <strong>
            NeerNayan Geographic
            Intelligence
          </strong>

          <span>
            Village risk +
            drinking-water source
            relationships
          </span>
        </div>

        <div className="map-status-tags">

          <span className="map-status-tag">
            {villages.length} Villages
          </span>

          <span className="map-status-tag">
            {waterSources.length} Sources
          </span>

          <span
            className={
              probableSources.length > 0
                ? "map-status-tag map-status-alert"
                : "map-status-tag"
            }
          >
            {probableSources.length}{" "}
            Probable Sources
          </span>

          <span
            className={
              warnings.length > 0
                ? "map-status-tag map-status-alert"
                : "map-status-tag"
            }
          >
            {warnings.length}{" "}
            Exposure Warnings
          </span>

          <span
            className="map-status-tag"
            style={{
              background:
                useOnlineTiles
                  ? "#e9f7ef"
                  : "#fff5db",

              color:
                useOnlineTiles
                  ? "#2e7550"
                  : "#8a6b20",
            }}
          >
            {useOnlineTiles
              ? "● Online Map"
              : "● Offline Demo Map"}
          </span>

        </div>

      </div>


      {/* ======================================================
          MAP
      ====================================================== */}

      <div className="map-wrapper">

        <MapContainer
          center={mapCenter}
          zoom={8}
          minZoom={6}
          maxZoom={14}
          scrollWheelZoom={true}
          className="intelligence-map"

          style={{
            background:
              "#dfece8",
          }}
        >

          {/* ==================================================
              ONLINE BASEMAP
          ================================================== */}

          {useOnlineTiles && (
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"

              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"

              eventHandlers={{
                tileerror: () => {
                  setTileFailure(
                    true
                  );
                },
              }}
            />
          )}


          {/* ==================================================
              OFFLINE GEOGRAPHIC CANVAS
          ================================================== */}

          {!useOnlineTiles && (
            <>
              <Rectangle
                bounds={
                  OFFLINE_BOUNDS
                }

                pathOptions={{
                  color:
                    "#7ba99e",

                  weight: 1,

                  fillColor:
                    "#eaf4f1",

                  fillOpacity: 1,
                }}
              />

              <Rectangle
                bounds={[
                  [25.05, 90.0],
                  [26.15, 92.55],
                ]}

                pathOptions={{
                  color:
                    "#9bbdb5",

                  weight: 1,

                  dashArray:
                    "5 6",

                  fillColor:
                    "#f4faf8",

                  fillOpacity:
                    0.35,
                }}
              >
                <Popup>
                  <strong>
                    Offline Geographic
                    Reference
                  </strong>

                  <br />

                  Meghalaya prototype
                  monitoring region.
                </Popup>
              </Rectangle>
            </>
          )}


          <LayersControl
            position="topright"
          >

            {/* ================================================
                RISK INTENSITY
            ================================================= */}

            <LayersControl.Overlay
              checked
              name="Risk Intensity"
            >
              <div>
                {validVillages.map(
                  (village) => {
                    const risk =
                      riskByVillageId[
                        Number(
                          village.id
                        )
                      ];

                    if (!risk) {
                      return null;
                    }

                    const score =
                      Number(
                        risk.risk_score
                      ) || 0;

                    const radius =
                      5000 +
                      score * 110;

                    const color =
                      getRiskColor(
                        risk.risk_level
                      );

                    return (
                      <Circle
                        key={`risk-area-${village.id}`}

                        center={[
                          getLatitude(
                            village
                          ),

                          getLongitude(
                            village
                          ),
                        ]}

                        radius={radius}

                        pathOptions={{
                          color,
                          fillColor:
                            color,

                          fillOpacity:
                            getRiskFillOpacity(
                              score
                            ),

                          opacity:
                            0.25,

                          weight: 1,
                        }}
                      />
                    );
                  }
                )}
              </div>
            </LayersControl.Overlay>


            {/* ================================================
                WATER SOURCE NETWORK
            ================================================= */}

            <LayersControl.Overlay
              checked
              name="Water Connections"
            >
              <div>
                {connections.map(
                  (connection) => (
                    <Polyline
                      key={`connection-${connection.id}`}

                      positions={
                        connection.positions
                      }

                      pathOptions={{
                        color:
                          connection.probable
                            ? "#c75c4d"
                            : "#4a8794",

                        weight:
                          connection.probable
                            ? 3
                            : 1.5,

                        opacity:
                          connection.probable
                            ? 0.85
                            : 0.42,

                        dashArray:
                          connection.probable
                            ? null
                            : "5 6",
                      }}
                    >
                      <Popup>
                        <strong>
                          {
                            connection
                              .source
                              .source_code
                          }
                          {" · "}
                          {
                            connection
                              .source
                              .source_name
                          }
                        </strong>

                        <br />

                        Connected to{" "}
                        {
                          connection
                            .village
                            .name
                        }

                        <br />

                        {connection.probable
                          ? "Probable source relationship"
                          : "Drinking-water relationship"}
                      </Popup>
                    </Polyline>
                  )
                )}
              </div>
            </LayersControl.Overlay>


            {/* ================================================
                VILLAGE RISK
            ================================================= */}

            <LayersControl.Overlay
              checked
              name="Village Risk"
            >
              <div>
                {validVillages.map(
                  (village) => {
                    const risk =
                      riskByVillageId[
                        Number(
                          village.id
                        )
                      ];

                    const level =
                      risk?.risk_level ||
                      "Normal";

                    const color =
                      getRiskColor(
                        level
                      );

                    return (
                      <CircleMarker
                        key={`village-${village.id}`}

                        center={[
                          getLatitude(
                            village
                          ),

                          getLongitude(
                            village
                          ),
                        ]}

                        radius={
                          level ===
                          "Priority"
                            ? 9
                            : level ===
                              "Investigate"
                            ? 8
                            : 7
                        }

                        pathOptions={{
                          color: "#ffffff",

                          weight: 2,

                          fillColor:
                            color,

                          fillOpacity:
                            0.95,
                        }}
                      >
                        <Popup>
                          <div
                            style={{
                              minWidth:
                                "190px",
                            }}
                          >
                            <strong>
                              {
                                village.name
                              }
                            </strong>

                            <br />

                            {village.district &&
                              `${village.district}`}

                            <hr
                              style={{
                                border: 0,

                                borderTop:
                                  "1px solid #e4ece9",

                                margin:
                                  "8px 0",
                              }}
                            />

                            Risk Score:{" "}
                            <strong>
                              {risk
                                ? `${risk.risk_score}/100`
                                : "Not calculated"}
                            </strong>

                            <br />

                            Status:{" "}
                            <strong
                              style={{
                                color,
                              }}
                            >
                              {level}
                            </strong>

                            <br />

                            {risk?.people_affected !==
                              undefined && (
                              <>
                                Health Cases:{" "}
                                <strong>
                                  {
                                    risk.people_affected
                                  }
                                </strong>

                                <br />
                              </>
                            )}

                            Population:{" "}
                            <strong>
                              {village.population ??
                                "N/A"}
                            </strong>
                          </div>
                        </Popup>
                      </CircleMarker>
                    );
                  }
                )}
              </div>
            </LayersControl.Overlay>


            {/* ================================================
                WATER SOURCES
            ================================================= */}

            <LayersControl.Overlay
              checked
              name="Water Sources"
            >
              <div>
                {waterSources
                  .filter(
                    hasCoordinates
                  )
                  .map(
                    (source) => {
                      const probable =
                        probableSourceIds.has(
                          Number(
                            source.id
                          )
                        );

                      return (
                        <CircleMarker
                          key={`source-${source.id}`}

                          center={[
                            getLatitude(
                              source
                            ),

                            getLongitude(
                              source
                            ),
                          ]}

                          radius={
                            probable
                              ? 9
                              : 6
                          }

                          pathOptions={{
                            color:
                              probable
                                ? "#8f372d"
                                : "#176b88",

                            fillColor:
                              probable
                                ? "#dc6755"
                                : "#278aaa",

                            fillOpacity:
                              0.95,

                            weight:
                              probable
                                ? 3
                                : 2,
                          }}
                        >
                          <Popup>
                            <strong>
                              {
                                source.source_code
                              }
                            </strong>

                            <br />

                            {
                              source.source_name
                            }

                            <br />

                            Type:{" "}
                            {
                              source.source_type
                            }

                            {probable && (
                              <>
                                <br />

                                <strong
                                  style={{
                                    color:
                                      "#a94335",
                                  }}
                                >
                                  Probable
                                  contamination
                                  source
                                </strong>
                              </>
                            )}
                          </Popup>
                        </CircleMarker>
                      );
                    }
                  )}
              </div>
            </LayersControl.Overlay>


            {/* ================================================
                EXPOSURE WARNINGS
            ================================================= */}

            <LayersControl.Overlay
              checked
              name="Exposure Warnings"
            >
              <div>
                {validVillages
                  .filter(
                    (village) =>
                      warningVillageIds.has(
                        Number(
                          village.id
                        )
                      )
                  )
                  .map(
                    (village) => {
                      const warning =
                        warnings.find(
                          (item) =>
                            Number(
                              item.village_id
                            ) ===
                              Number(
                                village.id
                              ) ||
                            item.village
                              ?.toLowerCase() ===
                              village.name.toLowerCase()
                        );

                      return (
                        <Circle
                          key={`warning-${village.id}`}

                          center={[
                            getLatitude(
                              village
                            ),

                            getLongitude(
                              village
                            ),
                          ]}

                          radius={9500}

                          pathOptions={{
                            color:
                              "#d59b32",

                            fillColor:
                              "#f5c35f",

                            fillOpacity:
                              0.08,

                            weight: 3,

                            dashArray:
                              "8 7",
                          }}
                        >
                          <Popup>
                            <strong>
                              Preventive
                              Exposure Warning
                            </strong>

                            <br />

                            {
                              village.name
                            }

                            {warning?.water_source && (
                              <>
                                <br />

                                Shared Source:{" "}
                                <strong>
                                  {
                                    warning.water_source
                                  }
                                </strong>
                              </>
                            )}

                            {warning?.recommended_action && (
                              <>
                                <br />
                                <br />

                                {
                                  warning.recommended_action
                                }
                              </>
                            )}
                          </Popup>
                        </Circle>
                      );
                    }
                  )}
              </div>
            </LayersControl.Overlay>

          </LayersControl>

        </MapContainer>


        {/* ====================================================
            LEGEND
        ==================================================== */}

        <div className="map-legend">

          <strong>
            Map Intelligence
          </strong>

          <div>
            <span className="legend-dot legend-priority" />
            Priority
          </div>

          <div>
            <span className="legend-dot legend-investigate" />
            Investigate
          </div>

          <div>
            <span className="legend-dot legend-watch" />
            Watch
          </div>

          <div>
            <span className="legend-dot legend-normal" />
            Normal
          </div>

          <div className="legend-divider" />

          <div>
            <span className="legend-source" />
            Water Source
          </div>

          <div>
            <span className="legend-probable-source" />
            Probable Source
          </div>

          <div>
            <span className="legend-warning" />
            Exposure Warning
          </div>

        </div>

      </div>


      {/* ======================================================
          MAP EXPLANATION
      ====================================================== */}

      <div className="map-explanation">

        <div>
          <strong>
            Risk Intensity
          </strong>

          <span>
            Larger halos indicate
            stronger village-level
            risk evidence.
          </span>
        </div>

        <div>
          <strong>
            Source Network
          </strong>

          <span>
            Lines connect villages to
            their drinking-water
            sources.
          </span>
        </div>

        <div>
          <strong>
            Preventive Exposure
          </strong>

          <span>
            Dashed warning zones
            identify connected villages
            requiring early
            verification.
          </span>
        </div>

      </div>


      {/* ======================================================
          OFFLINE / PROTOTYPE NOTE
      ====================================================== */}

      <p className="prototype-map-note">

        {useOnlineTiles
          ? "Online basemap active. Risk, source and exposure intelligence are generated locally by the NeerNayan prototype."
          : "Offline Demo Mode active. Basemap tiles are unavailable, but all village coordinates, risk intelligence, drinking-water relationships and exposure warnings continue to operate locally."}

      </p>

    </div>
  );
}

export default RiskMap;
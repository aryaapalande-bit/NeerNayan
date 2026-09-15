from datetime import timedelta

import models


# ============================================================
# CONFIGURATION
# ============================================================

# Historical signals should be reasonably close in time
# before they are combined into one risk score.

SIGNAL_WINDOW_DAYS = 120

# Minimum health score considered an elevated community signal.

ELEVATED_HEALTH_THRESHOLD = 18


# ============================================================
# HELPER
# ============================================================

def is_within_window(
    record_date,
    reference_date,
    days=SIGNAL_WINDOW_DAYS
):
    if not record_date or not reference_date:
        return False

    difference = (
        reference_date - record_date
    )

    return (
        difference.days >= 0
        and difference.days <= days
    )


# ============================================================
# HEALTH RISK SCORE
# Maximum = 40
# ============================================================

def calculate_health_score(report):

    if not report:
        return 0

    cases = (
        report.people_affected
        if report.people_affected
        else 0
    )

    # --------------------------------------------------------
    # CASE BURDEN
    # Maximum = 30
    # --------------------------------------------------------

    if cases <= 0:

        case_score = 0

    elif cases <= 5:

        case_score = 8

    elif cases <= 15:

        case_score = 14

    elif cases <= 30:

        case_score = 20

    elif cases <= 50:

        case_score = 26

    else:

        case_score = 30

    # --------------------------------------------------------
    # SYMPTOM / DISEASE SIGNALS
    # Maximum additional = 10
    # --------------------------------------------------------

    symptom_score = 0

    if report.diarrhea:
        symptom_score += 4

    if report.vomiting:
        symptom_score += 2

    if report.abdominal_pain:
        symptom_score += 2

    if report.fever:
        symptom_score += 2

    if report.jaundice:
        symptom_score += 2

    total = (
        case_score
        + symptom_score
    )

    return min(
        total,
        40
    )


# ============================================================
# WATER QUALITY SCORE
# Maximum = 30
# ============================================================

def calculate_water_score(test):

    if not test:
        return 0

    score = 0

    # --------------------------------------------------------
    # MICROBIAL SIGNAL
    # --------------------------------------------------------

    if test.microbial_contamination:
        score += 12

    # --------------------------------------------------------
    # pH
    # Recommended drinking-water range is approximated
    # here as 6.5 - 8.5 for prototype risk scoring.
    # --------------------------------------------------------

    if test.ph is not None:

        if (
            test.ph < 6.5
            or test.ph > 8.5
        ):
            score += 3

    # --------------------------------------------------------
    # TURBIDITY
    # --------------------------------------------------------

    turbidity = (
        test.turbidity
        or ""
    ).lower()

    if turbidity == "high":

        score += 6

    elif turbidity == "moderate":

        score += 3

    # --------------------------------------------------------
    # RESIDUAL CHLORINE
    # --------------------------------------------------------

    chlorine = (
        test.residual_chlorine
        or ""
    ).lower()

    if chlorine == "low":

        score += 5

    elif chlorine == "high":

        score += 2

    # --------------------------------------------------------
    # IMPORTED SAFE / UNSAFE STATUS
    #
    # During dataset import the workbook status was preserved
    # inside tested_by:
    #
    # Historical Dataset (Unsafe)
    #
    # We use that status as an additional water-quality
    # warning, but DO NOT interpret it as microbial evidence.
    # --------------------------------------------------------

    tested_by = (
        test.tested_by
        or ""
    ).lower()

    if "unsafe" in tested_by:

        score += 6

    return min(
        score,
        30
    )


# ============================================================
# RAINFALL / FLOOD SCORE
# Maximum = 10
# ============================================================

def calculate_rainfall_score(rainfall):

    if not rainfall:
        return 0

    score = 0

    rainfall_level = (
        rainfall.rainfall_level
        or ""
    ).lower()

    # --------------------------------------------------------
    # FLOOD RISK
    # --------------------------------------------------------

    if rainfall.flood_risk:

        score += 4

    # --------------------------------------------------------
    # RISK CATEGORY
    # --------------------------------------------------------

    if rainfall_level in [
        "high",
        "heavy"
    ]:

        score += 3

    elif rainfall_level in [
        "medium",
        "moderate"
    ]:

        score += 2

    # --------------------------------------------------------
    # RAINFALL MAGNITUDE
    # --------------------------------------------------------

    rainfall_mm = (
        rainfall.rainfall_mm
        or 0
    )

    if rainfall_mm >= 500:

        score += 4

    elif rainfall_mm >= 250:

        score += 3

    elif rainfall_mm >= 100:

        score += 2

    return min(
        score,
        10
    )


# ============================================================
# RISK LEVEL
# ============================================================

def get_risk_level(score):

    if score <= 30:
        return "Normal"

    if score <= 50:
        return "Watch"

    if score <= 75:
        return "Investigate"

    return "Priority"


# ============================================================
# LATEST HEALTH REPORT
# ============================================================

def get_latest_health_report(
    db,
    village_id,
    reference_date=None
):

    query = (
        db.query(
            models.SymptomReport
        )
        .filter(
            models.SymptomReport.village_id
            == village_id
        )
    )

    if reference_date:

        query = query.filter(
            models.SymptomReport.created_at
            <= reference_date
        )

    return (
        query
        .order_by(
            models.SymptomReport.created_at.desc(),
            models.SymptomReport.id.desc()
        )
        .first()
    )


# ============================================================
# LATEST / STRONGEST WATER TEST
# ============================================================

def get_latest_water_test(
    db,
    water_source_id,
    reference_date=None
):

    if not water_source_id:
        return None

    query = (
        db.query(
            models.WaterQualityTest
        )
        .filter(
            models.WaterQualityTest.water_source_id
            == water_source_id
        )
    )

    if reference_date:

        query = query.filter(
            models.WaterQualityTest.created_at
            <= reference_date
        )

    latest_test = (
        query
        .order_by(
            models.WaterQualityTest.created_at.desc(),
            models.WaterQualityTest.id.desc()
        )
        .first()
    )

    if not latest_test:
        return None

    latest_date = (
        latest_test.created_at
    )

    # A shared source can have multiple readings
    # recorded on the same date.
    #
    # For early-warning purposes, use the strongest
    # water-quality warning from that latest date.

    same_date_tests = (
        db.query(
            models.WaterQualityTest
        )
        .filter(
            models.WaterQualityTest.water_source_id
            == water_source_id
        )
        .filter(
            models.WaterQualityTest.created_at
            == latest_date
        )
        .all()
    )

    if not same_date_tests:
        return latest_test

    return max(
        same_date_tests,
        key=calculate_water_score
    )


# ============================================================
# LATEST RAINFALL RECORD
# ============================================================

def get_latest_rainfall(
    db,
    village_id,
    reference_date=None
):

    query = (
        db.query(
            models.RainfallData
        )
        .filter(
            models.RainfallData.village_id
            == village_id
        )
    )

    if reference_date:

        query = query.filter(
            models.RainfallData.created_at
            <= reference_date
        )

    return (
        query
        .order_by(
            models.RainfallData.created_at.desc(),
            models.RainfallData.id.desc()
        )
        .first()
    )


# ============================================================
# SHARED SOURCE SCORE
# Maximum = 20
# ============================================================

def calculate_shared_source_score(
    db,
    source_id,
    reference_date=None
):

    if not source_id:
        return 0

    links = (
        db.query(
            models.VillageWaterLink
        )
        .filter(
            models.VillageWaterLink.water_source_id
            == source_id
        )
        .all()
    )

    # Not a shared source
    if len(links) < 2:
        return 0

    elevated_villages = 0

    for link in links:

        report = (
            get_latest_health_report(
                db,
                link.village_id,
                reference_date
            )
        )

        if not report:
            continue

        if reference_date:

            if not is_within_window(
                report.created_at,
                reference_date
            ):
                continue

        health_score = (
            calculate_health_score(
                report
            )
        )

        if (
            health_score
            >= ELEVATED_HEALTH_THRESHOLD
        ):
            elevated_villages += 1

    if elevated_villages >= 2:
        return 20

    return 0


# ============================================================
# VILLAGE RISK ANALYSIS
# ============================================================

def calculate_village_risk(
    db,
    village
):

    # --------------------------------------------------------
    # WATER SOURCE LINK
    # --------------------------------------------------------

    water_link = (
        db.query(
            models.VillageWaterLink
        )
        .filter(
            models.VillageWaterLink.village_id
            == village.id
        )
        .first()
    )

    water_source_id = None
    water_source_code = None
    water_source_name = None

    if water_link:

        water_source_id = (
            water_link.water_source_id
        )

        source = (
            db.query(
                models.WaterSource
            )
            .filter(
                models.WaterSource.id
                == water_source_id
            )
            .first()
        )

        if source:

            water_source_code = (
                source.source_code
            )

            water_source_name = (
                source.source_name
            )

    # --------------------------------------------------------
    # HEALTH REFERENCE DATE
    # --------------------------------------------------------

    health_report = (
        get_latest_health_report(
            db,
            village.id
        )
    )

    reference_date = None

    if health_report:

        reference_date = (
            health_report.created_at
        )

    else:

        preliminary_water = (
            get_latest_water_test(
                db,
                water_source_id
            )
        )

        preliminary_rainfall = (
            get_latest_rainfall(
                db,
                village.id
            )
        )

        available_dates = []

        if preliminary_water:
            available_dates.append(
                preliminary_water.created_at
            )

        if preliminary_rainfall:
            available_dates.append(
                preliminary_rainfall.created_at
            )

        if available_dates:

            reference_date = max(
                available_dates
            )

    # --------------------------------------------------------
    # WATER TEST ALIGNED TO HEALTH PERIOD
    # --------------------------------------------------------

    water_test = (
        get_latest_water_test(
            db,
            water_source_id,
            reference_date
        )
        if water_source_id
        else None
    )

    # --------------------------------------------------------
    # RAINFALL ALIGNED TO HEALTH PERIOD
    # --------------------------------------------------------

    rainfall = (
        get_latest_rainfall(
            db,
            village.id,
            reference_date
        )
    )

    # --------------------------------------------------------
    # HEALTH SCORE
    # --------------------------------------------------------

    health_score = (
        calculate_health_score(
            health_report
        )
    )

    # --------------------------------------------------------
    # WATER SCORE
    #
    # Ignore water evidence if it is too far away
    # from the health reference period.
    # --------------------------------------------------------

    water_score = 0

    if water_test:

        if (
            reference_date is None
            or is_within_window(
                water_test.created_at,
                reference_date
            )
        ):

            water_score = (
                calculate_water_score(
                    water_test
                )
            )

    # --------------------------------------------------------
    # RAINFALL SCORE
    # --------------------------------------------------------

    rainfall_score = 0

    if rainfall:

        if (
            reference_date is None
            or is_within_window(
                rainfall.created_at,
                reference_date
            )
        ):

            rainfall_score = (
                calculate_rainfall_score(
                    rainfall
                )
            )

    # --------------------------------------------------------
    # SHARED SOURCE SIGNAL
    # --------------------------------------------------------

    shared_source_score = (
        calculate_shared_source_score(
            db,
            water_source_id,
            reference_date
        )
    )

    # --------------------------------------------------------
    # FINAL SCORE
    # --------------------------------------------------------

    risk_score = min(
        health_score
        + water_score
        + shared_source_score
        + rainfall_score,
        100
    )

    risk_level = (
        get_risk_level(
            risk_score
        )
    )

    # --------------------------------------------------------
    # OUTPUT
    # --------------------------------------------------------

    return {
        "village_id":
            village.id,

        "village":
            village.name,

        "district":
            village.district,

        "population":
            village.population,

        "latitude":
            village.latitude,

        "longitude":
            village.longitude,

        "water_source_id":
            water_source_id,

        "water_source":
            water_source_code,

        "water_source_name":
            water_source_name,

        "risk_score":
            risk_score,

        "risk_level":
            risk_level,

        "people_affected":
            (
                health_report.people_affected
                if health_report
                else 0
            ),

        "reference_date":
            (
                reference_date.isoformat()
                if reference_date
                else None
            ),

        "evidence": {
            "health":
                health_score,

            "water":
                water_score,

            "shared":
                shared_source_score,

            "rainfall":
                rainfall_score,
        },

        "evidence_dates": {
            "health":
                (
                    health_report.created_at.isoformat()
                    if health_report
                    else None
                ),

            "water":
                (
                    water_test.created_at.isoformat()
                    if water_test
                    else None
                ),

            "rainfall":
                (
                    rainfall.created_at.isoformat()
                    if rainfall
                    else None
                ),
        },
    }


# ============================================================
# PROBABLE CONTAMINATION SOURCE DETECTION
# ============================================================

def detect_probable_sources(db):

    sources = (
        db.query(
            models.WaterSource
        )
        .order_by(
            models.WaterSource.id
        )
        .all()
    )

    probable_sources = []

    for source in sources:

        links = (
            db.query(
                models.VillageWaterLink
            )
            .filter(
                models.VillageWaterLink.water_source_id
                == source.id
            )
            .all()
        )

        # Source attribution requires
        # at least two connected villages.

        if len(links) < 2:
            continue

        latest_reports = []

        for link in links:

            report = (
                get_latest_health_report(
                    db,
                    link.village_id
                )
            )

            if report:

                latest_reports.append(
                    (
                        link,
                        report
                    )
                )

        if not latest_reports:
            continue

        reference_date = max(
            report.created_at
            for _, report
            in latest_reports
        )

        elevated_villages = []

        health_scores = []

        for link, report in latest_reports:

            if not is_within_window(
                report.created_at,
                reference_date
            ):
                continue

            health_score = (
                calculate_health_score(
                    report
                )
            )

            if (
                health_score
                >= ELEVATED_HEALTH_THRESHOLD
            ):

                village = (
                    db.query(
                        models.Village
                    )
                    .filter(
                        models.Village.id
                        == link.village_id
                    )
                    .first()
                )

                if village:

                    elevated_villages.append(
                        village.name
                    )

                    health_scores.append(
                        health_score
                    )

        # Need health signals in at least
        # two connected communities.

        if len(
            elevated_villages
        ) < 2:
            continue

        water_test = (
            get_latest_water_test(
                db,
                source.id,
                reference_date
            )
        )

        if not water_test:
            continue

        if not is_within_window(
            water_test.created_at,
            reference_date
        ):
            continue

        water_score = (
            calculate_water_score(
                water_test
            )
        )

        # Need meaningful water-quality evidence.

        if water_score < 8:
            continue

        average_health_score = (
            sum(health_scores)
            / len(health_scores)
        )

        if (
            water_score >= 15
            and average_health_score >= 20
        ):

            evidence_strength = "High"

        else:

            evidence_strength = "Moderate"

        probable_sources.append({
            "water_source_id":
                source.id,

            "source_code":
                source.source_code,

            "source_name":
                source.source_name,

            "source_type":
                source.source_type,

            "affected_villages":
                elevated_villages,

            "connected_villages":
                len(links),

            "water_evidence_score":
                water_score,

            "evidence_strength":
                evidence_strength,

            "reason":
                (
                    f"{len(elevated_villages)} "
                    "connected villages show elevated "
                    "health signals during the same "
                    "historical risk period, while the "
                    f"shared water source has a "
                    f"water-quality evidence score of "
                    f"{water_score}/30."
                ),

            "recommended_action":
                (
                    "Verify the shared water source, "
                    "conduct field investigation and "
                    "increase surveillance in all "
                    "connected communities."
                ),
        })

    return probable_sources


# ============================================================
# NEXT-VILLAGE / CONNECTED EXPOSURE INTELLIGENCE
# ============================================================

def detect_exposed_villages(db):

    probable_sources = (
        detect_probable_sources(
            db
        )
    )

    warnings = []

    for probable in probable_sources:

        source_id = (
            probable[
                "water_source_id"
            ]
        )

        source_code = (
            probable[
                "source_code"
            ]
        )

        source_name = (
            probable[
                "source_name"
            ]
        )

        elevated_villages = set(
            probable[
                "affected_villages"
            ]
        )

        links = (
            db.query(
                models.VillageWaterLink
            )
            .filter(
                models.VillageWaterLink.water_source_id
                == source_id
            )
            .all()
        )

        # ----------------------------------------------------
        # Reference period for this source
        # ----------------------------------------------------

        source_reports = []

        for link in links:

            report = (
                get_latest_health_report(
                    db,
                    link.village_id
                )
            )

            if report:
                source_reports.append(
                    report
                )

        reference_date = None

        if source_reports:

            reference_date = max(
                report.created_at
                for report
                in source_reports
            )

        # ----------------------------------------------------
        # FIND CONNECTED LOWER-SIGNAL VILLAGES
        # ----------------------------------------------------

        for link in links:

            village = (
                db.query(
                    models.Village
                )
                .filter(
                    models.Village.id
                    == link.village_id
                )
                .first()
            )

            if not village:
                continue

            # Already part of elevated cluster
            if (
                village.name
                in elevated_villages
            ):
                continue

            report = (
                get_latest_health_report(
                    db,
                    village.id,
                    reference_date
                )
            )

            health_score = (
                calculate_health_score(
                    report
                )
            )

            # This is a preventive warning for
            # a connected village with either:
            #
            # - no current aligned health signal
            # - or a lower signal than the
            #   elevated cluster threshold.

            if (
                health_score
                < ELEVATED_HEALTH_THRESHOLD
            ):

                if health_score == 0:

                    warning_text = (
                        f"{village.name} shares "
                        f"{source_code}, a probable "
                        "contamination source, but no "
                        "elevated health signal is "
                        "currently present in the "
                        "aligned monitoring period."
                    )

                else:

                    warning_text = (
                        f"{village.name} shares "
                        f"{source_code}, a probable "
                        "contamination source. Its "
                        "current health signal remains "
                        "below the elevated-cluster "
                        "threshold, so preventive "
                        "verification is recommended."
                    )

                warnings.append({
                    "village_id":
                        village.id,

                    "village":
                        village.name,

                    "district":
                        village.district,

                    "water_source_id":
                        source_id,

                    "water_source":
                        source_code,

                    "water_source_name":
                        source_name,

                    "health_signal_score":
                        health_score,

                    "warning":
                        warning_text,

                    "recommended_action":
                        (
                            "Verify drinking-water safety, "
                            "increase community symptom "
                            "surveillance and provide "
                            "preventive safe-water guidance."
                        ),
                })

    return warnings
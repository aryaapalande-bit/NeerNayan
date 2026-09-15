from collections import defaultdict
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import engine, get_db

import models

from risk_engine import (
    calculate_village_risk,
    calculate_health_score,
    calculate_water_score,
    calculate_rainfall_score,
    detect_probable_sources,
    detect_exposed_villages,
)


# ============================================================
# CREATE DATABASE TABLES
# ============================================================

models.Base.metadata.create_all(bind=engine)


# ============================================================
# FASTAPI APP
# ============================================================

app = FastAPI(
    title="NeerNayan API",
    description=(
        "Community health early-warning and "
        "decision-support system for water-borne "
        "disease risk."
    ),
    version="1.0.0",
)


# ============================================================
# CORS
# ============================================================


allow_origins=[
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://neer-nayan.vercel.app",
],


# ============================================================
# PYDANTIC SCHEMAS
# ============================================================

class SymptomReportCreate(BaseModel):
    village_id: int
    people_affected: int

    diarrhea: bool = False
    vomiting: bool = False
    fever: bool = False
    jaundice: bool = False
    abdominal_pain: bool = False

    reported_by: str = "ASHA Worker"


class WaterQualityTestCreate(BaseModel):
    water_source_id: int

    ph: Optional[float] = None
    turbidity: str = "Normal"
    residual_chlorine: str = "Normal"
    microbial_contamination: bool = False

    tested_by: str = (
        "Field Water Quality Worker"
    )


class CitizenReportCreate(BaseModel):
    village_id: int

    people_affected: int = 1

    diarrhea: bool = False
    vomiting: bool = False
    fever: bool = False
    jaundice: bool = False
    abdominal_pain: bool = False

    symptom_start: Optional[str] = None
    used_community_water: bool = True
    reporter_name: Optional[str] = None


class InterventionCreate(BaseModel):
    village_id: int

    water_source_id: Optional[int] = None
    priority_level: str = "Medium"

    intervention_type: str = (
        "Field Investigation"
    )

    assigned_to: Optional[str] = None
    action_notes: Optional[str] = None


class InterventionUpdate(BaseModel):
    status: str

    assigned_to: Optional[str] = None
    action_notes: Optional[str] = None
    outcome_notes: Optional[str] = None


# ============================================================
# HOME
# ============================================================

@app.get("/")
def home():
    return {
        "message":
            "NeerNayan backend is running",

        "system":
            "Early Warning & Decision Support System",
    }


# ============================================================
# VILLAGES
# ============================================================

@app.get("/villages")
def get_villages(
    db: Session = Depends(get_db)
):
    villages = (
        db.query(models.Village)
        .order_by(models.Village.id)
        .all()
    )

    return [
        {
            "id": village.id,
            "name": village.name,
            "district": village.district,
            "state": village.state,
            "population": village.population,
            "latitude": village.latitude,
            "longitude": village.longitude,
        }
        for village in villages
    ]


# ============================================================
# WATER SOURCES
# ============================================================

@app.get("/water-sources")
def get_water_sources(
    db: Session = Depends(get_db)
):
    sources = (
        db.query(models.WaterSource)
        .order_by(models.WaterSource.id)
        .all()
    )

    return [
        {
            "id": source.id,
            "source_code":
                source.source_code,
            "source_name":
                source.source_name,
            "source_type":
                source.source_type,
            "latitude":
                source.latitude,
            "longitude":
                source.longitude,
        }
        for source in sources
    ]


# ============================================================
# VILLAGE ↔ WATER SOURCE NETWORK
# ============================================================

@app.get("/network")
def get_network(
    db: Session = Depends(get_db)
):
    links = (
        db.query(models.VillageWaterLink)
        .all()
    )

    result = []

    for link in links:

        village = (
            db.query(models.Village)
            .filter(
                models.Village.id ==
                link.village_id
            )
            .first()
        )

        source = (
            db.query(models.WaterSource)
            .filter(
                models.WaterSource.id ==
                link.water_source_id
            )
            .first()
        )

        result.append({
            "village_id":
                link.village_id,

            "village":
                village.name
                if village
                else "Unknown",

            "water_source_id":
                link.water_source_id,

            "water_source":
                source.source_code
                if source
                else "Unknown",

            "water_source_name":
                source.source_name
                if source
                else "Unknown",
        })

    return result


# ============================================================
# ASHA HEALTH REPORT
# ============================================================

@app.post("/symptom-reports")
def create_symptom_report(
    report: SymptomReportCreate,
    db: Session = Depends(get_db)
):
    village = (
        db.query(models.Village)
        .filter(
            models.Village.id ==
            report.village_id
        )
        .first()
    )

    if not village:
        raise HTTPException(
            status_code=404,
            detail="Village not found"
        )

    water_link = (
        db.query(models.VillageWaterLink)
        .filter(
            models.VillageWaterLink.village_id ==
            report.village_id
        )
        .first()
    )

    water_source_id = None
    water_source_code = "Not linked"

    if water_link:

        water_source_id = (
            water_link.water_source_id
        )

        source = (
            db.query(models.WaterSource)
            .filter(
                models.WaterSource.id ==
                water_source_id
            )
            .first()
        )

        if source:
            water_source_code = (
                source.source_code
            )

    symptom_report = models.SymptomReport(
        village_id=
            report.village_id,

        water_source_id=
            water_source_id,

        people_affected=
            report.people_affected,

        diarrhea=
            report.diarrhea,

        vomiting=
            report.vomiting,

        fever=
            report.fever,

        jaundice=
            report.jaundice,

        abdominal_pain=
            report.abdominal_pain,

        reported_by=
            report.reported_by,
    )

    db.add(symptom_report)
    db.commit()
    db.refresh(symptom_report)

    return {
        "message":
            "ASHA symptom report submitted successfully",

        "report_id":
            symptom_report.id,

        "village":
            village.name,

        "water_source":
            water_source_code,

        "people_affected":
            symptom_report.people_affected,

        "next_step":
            "NeerNayan risk analysis updated",
    }


# ============================================================
# GET ASHA / HEALTH REPORTS
# ============================================================

@app.get("/symptom-reports")
def get_symptom_reports(
    db: Session = Depends(get_db)
):
    reports = (
        db.query(models.SymptomReport)
        .order_by(
            models.SymptomReport.created_at.desc()
        )
        .all()
    )

    result = []

    for report in reports:

        village = (
            db.query(models.Village)
            .filter(
                models.Village.id ==
                report.village_id
            )
            .first()
        )

        source = None

        if report.water_source_id:

            source = (
                db.query(models.WaterSource)
                .filter(
                    models.WaterSource.id ==
                    report.water_source_id
                )
                .first()
            )

        result.append({
            "id": report.id,
            "village_id": report.village_id,

            "village":
                village.name
                if village
                else "Unknown",

            "water_source_id":
                report.water_source_id,

            "water_source":
                source.source_code
                if source
                else None,

            "people_affected":
                report.people_affected,

            "diarrhea":
                report.diarrhea,

            "vomiting":
                report.vomiting,

            "fever":
                report.fever,

            "jaundice":
                report.jaundice,

            "abdominal_pain":
                report.abdominal_pain,

            "reported_by":
                report.reported_by,

            "created_at":
                report.created_at,
        })

    return result


# ============================================================
# WATER QUALITY REPORT
# ============================================================

@app.post("/water-tests")
def create_water_test(
    test: WaterQualityTestCreate,
    db: Session = Depends(get_db)
):
    source = (
        db.query(models.WaterSource)
        .filter(
            models.WaterSource.id ==
            test.water_source_id
        )
        .first()
    )

    if not source:
        raise HTTPException(
            status_code=404,
            detail="Water source not found"
        )

    water_test = models.WaterQualityTest(
        water_source_id=
            test.water_source_id,

        ph=
            test.ph,

        turbidity=
            test.turbidity,

        residual_chlorine=
            test.residual_chlorine,

        microbial_contamination=
            test.microbial_contamination,

        tested_by=
            test.tested_by,
    )

    db.add(water_test)
    db.commit()
    db.refresh(water_test)

    return {
        "message":
            "Water quality test submitted successfully",

        "test_id":
            water_test.id,

        "water_source":
            source.source_code,

        "source_name":
            source.source_name,

        "ph":
            water_test.ph,

        "turbidity":
            water_test.turbidity,

        "residual_chlorine":
            water_test.residual_chlorine,

        "microbial_contamination":
            water_test.microbial_contamination,

        "next_step":
            "NeerNayan risk analysis updated",
    }


# ============================================================
# GET WATER TESTS
# ============================================================

@app.get("/water-tests")
def get_water_tests(
    db: Session = Depends(get_db)
):
    tests = (
        db.query(models.WaterQualityTest)
        .order_by(
            models.WaterQualityTest.created_at.desc()
        )
        .all()
    )

    result = []

    for test in tests:

        source = (
            db.query(models.WaterSource)
            .filter(
                models.WaterSource.id ==
                test.water_source_id
            )
            .first()
        )

        result.append({
            "id":
                test.id,

            "water_source_id":
                test.water_source_id,

            "water_source":
                source.source_code
                if source
                else "Unknown",

            "source_name":
                source.source_name
                if source
                else "Unknown",

            "ph":
                test.ph,

            "turbidity":
                test.turbidity,

            "residual_chlorine":
                test.residual_chlorine,

            "microbial_contamination":
                test.microbial_contamination,

            "tested_by":
                test.tested_by,

            "created_at":
                test.created_at,
        })

    return result


# ============================================================
# CITIZEN REPORT
# ============================================================

@app.post("/citizen-reports")
def create_citizen_report(
    report: CitizenReportCreate,
    db: Session = Depends(get_db)
):
    village = (
        db.query(models.Village)
        .filter(
            models.Village.id ==
            report.village_id
        )
        .first()
    )

    if not village:
        raise HTTPException(
            status_code=404,
            detail="Village not found"
        )

    citizen_report = models.CitizenReport(
        village_id=
            report.village_id,

        people_affected=
            report.people_affected,

        diarrhea=
            report.diarrhea,

        vomiting=
            report.vomiting,

        fever=
            report.fever,

        jaundice=
            report.jaundice,

        abdominal_pain=
            report.abdominal_pain,

        symptom_start=
            report.symptom_start,

        used_community_water=
            report.used_community_water,

        reporter_name=
            report.reporter_name,

        verification_status=
            "Unverified",
    )

    db.add(citizen_report)
    db.commit()
    db.refresh(citizen_report)

    return {
        "message":
            "Citizen health report submitted successfully",

        "report_id":
            citizen_report.id,

        "village":
            village.name,

        "verification_status":
            citizen_report.verification_status,

        "next_step":
            (
                "This report is treated as an early "
                "community signal until verified "
                "by a health worker."
            ),
    }


# ============================================================
# GET CITIZEN REPORTS
# ============================================================

@app.get("/citizen-reports")
def get_citizen_reports(
    db: Session = Depends(get_db)
):
    reports = (
        db.query(models.CitizenReport)
        .order_by(
            models.CitizenReport.created_at.desc()
        )
        .all()
    )

    result = []

    for report in reports:

        village = (
            db.query(models.Village)
            .filter(
                models.Village.id ==
                report.village_id
            )
            .first()
        )

        result.append({
            "id":
                report.id,

            "village_id":
                report.village_id,

            "village":
                village.name
                if village
                else "Unknown",

            "people_affected":
                report.people_affected,

            "diarrhea":
                report.diarrhea,

            "vomiting":
                report.vomiting,

            "fever":
                report.fever,

            "jaundice":
                report.jaundice,

            "abdominal_pain":
                report.abdominal_pain,

            "symptom_start":
                report.symptom_start,

            "used_community_water":
                report.used_community_water,

            "reporter_name":
                report.reporter_name,

            "verification_status":
                report.verification_status,

            "created_at":
                report.created_at,
        })

    return result


# ============================================================
# VILLAGE RISK ANALYSIS
# ============================================================

@app.get("/risk-analysis")
def risk_analysis(
    db: Session = Depends(get_db)
):
    villages = (
        db.query(models.Village)
        .order_by(models.Village.id)
        .all()
    )

    result = []

    for village in villages:

        analysis = (
            calculate_village_risk(
                db,
                village
            )
        )

        result.append(analysis)

    return result


# ============================================================
# PROBABLE SOURCES
# ============================================================

@app.get("/probable-sources")
def probable_sources(
    db: Session = Depends(get_db)
):
    return detect_probable_sources(db)


# ============================================================
# EXPOSURE WARNINGS
# ============================================================

@app.get("/exposure-warnings")
def exposure_warnings(
    db: Session = Depends(get_db)
):
    return detect_exposed_villages(db)


# ============================================================
# GOVERNMENT INTERVENTION PRIORITY
# ============================================================

@app.get("/intervention-priority")
def intervention_priority(
    db: Session = Depends(get_db)
):
    villages = (
        db.query(models.Village)
        .order_by(models.Village.id)
        .all()
    )

    exposure_warnings_data = (
        detect_exposed_villages(db)
    )

    warning_villages = {
        warning.get("village")
        for warning
        in exposure_warnings_data
    }

    priorities = []

    for village in villages:

        risk = (
            calculate_village_risk(
                db,
                village
            )
        )

        base_score = risk.get(
            "risk_score",
            0
        )

        citizen_reports = (
            db.query(models.CitizenReport)
            .filter(
                models.CitizenReport.village_id ==
                village.id
            )
            .filter(
                models.CitizenReport.verification_status ==
                "Unverified"
            )
            .count()
        )

        citizen_bonus = min(
            citizen_reports * 3,
            10
        )

        exposure_bonus = (
            10
            if village.name
            in warning_villages
            else 0
        )

        priority_score = min(
            base_score
            + citizen_bonus
            + exposure_bonus,
            100
        )

        if priority_score >= 80:

            priority_level = "Critical"

            recommended_action = (
                "Immediate field investigation, "
                "verify the linked water source, "
                "provide safe drinking-water support "
                "and alert local health teams."
            )

        elif priority_score >= 60:

            priority_level = "High"

            recommended_action = (
                "Conduct water-source verification "
                "and active symptom surveillance "
                "within the community."
            )

        elif priority_score >= 40:

            priority_level = "Medium"

            recommended_action = (
                "Increase monitoring and review "
                "new health and water-quality reports."
            )

        else:

            priority_level = "Low"

            recommended_action = (
                "Continue routine surveillance."
            )

        priorities.append({
            "village_id":
                village.id,

            "village":
                village.name,

            "priority_score":
                priority_score,

            "priority_level":
                priority_level,

            "risk_score":
                base_score,

            "risk_level":
                risk.get(
                    "risk_level",
                    "Normal"
                ),

            "citizen_signals":
                citizen_reports,

            "exposure_warning":
                village.name
                in warning_villages,

            "water_source_id":
                risk.get(
                    "water_source_id"
                ),

            "recommended_action":
                recommended_action,
        })

    priorities.sort(
        key=lambda item:
            item["priority_score"],
        reverse=True
    )

    return priorities


# ============================================================
# HISTORICAL TREND INTELLIGENCE
# ============================================================

@app.get("/historical-trends")
def historical_trends(
    village_id: int,
    db: Session = Depends(get_db)
):
    # --------------------------------------------------------
    # VILLAGE
    # --------------------------------------------------------

    village = (
        db.query(models.Village)
        .filter(
            models.Village.id ==
            village_id
        )
        .first()
    )

    if not village:
        raise HTTPException(
            status_code=404,
            detail="Village not found"
        )

    # --------------------------------------------------------
    # WATER SOURCE
    # --------------------------------------------------------

    water_link = (
        db.query(models.VillageWaterLink)
        .filter(
            models.VillageWaterLink.village_id ==
            village_id
        )
        .first()
    )

    water_source = None

    if water_link:

        water_source = (
            db.query(models.WaterSource)
            .filter(
                models.WaterSource.id ==
                water_link.water_source_id
            )
            .first()
        )

    # ========================================================
    # HEALTH TREND
    # ========================================================

    health_records = (
        db.query(models.SymptomReport)
        .filter(
            models.SymptomReport.village_id ==
            village_id
        )
        .order_by(
            models.SymptomReport.created_at.asc()
        )
        .all()
    )

    health_grouped = defaultdict(
        lambda: {
            "cases": 0,
            "health_risk": 0,
            "reports": 0,
        }
    )

    for record in health_records:

        if not record.created_at:
            continue

        date_key = (
            record.created_at
            .date()
            .isoformat()
        )

        health_grouped[
            date_key
        ]["cases"] += (
            record.people_affected
            or 0
        )

        health_grouped[
            date_key
        ]["health_risk"] = max(
            health_grouped[
                date_key
            ]["health_risk"],

            calculate_health_score(
                record
            )
        )

        health_grouped[
            date_key
        ]["reports"] += 1

    health_trend = [
        {
            "date": date,
            "cases": values["cases"],
            "health_risk":
                values["health_risk"],
            "reports":
                values["reports"],
        }
        for date, values
        in sorted(
            health_grouped.items()
        )
    ]

    # ========================================================
    # WATER QUALITY TREND
    # ========================================================

    water_trend = []

    if water_link:

        water_records = (
            db.query(
                models.WaterQualityTest
            )
            .filter(
                models.WaterQualityTest.water_source_id ==
                water_link.water_source_id
            )
            .order_by(
                models.WaterQualityTest.created_at.asc()
            )
            .all()
        )

        water_grouped = defaultdict(
            lambda: {
                "water_risk": 0,
                "ph_values": [],
                "tests": 0,
                "unsafe": False,
            }
        )

        for record in water_records:

            if not record.created_at:
                continue

            date_key = (
                record.created_at
                .date()
                .isoformat()
            )

            water_grouped[
                date_key
            ]["water_risk"] = max(
                water_grouped[
                    date_key
                ]["water_risk"],

                calculate_water_score(
                    record
                )
            )

            if record.ph is not None:

                water_grouped[
                    date_key
                ]["ph_values"].append(
                    record.ph
                )

            water_grouped[
                date_key
            ]["tests"] += 1

            if "unsafe" in (
                record.tested_by
                or ""
            ).lower():

                water_grouped[
                    date_key
                ]["unsafe"] = True

        for date, values in sorted(
            water_grouped.items()
        ):

            average_ph = None

            if values["ph_values"]:

                average_ph = round(
                    sum(
                        values[
                            "ph_values"
                        ]
                    )
                    / len(
                        values[
                            "ph_values"
                        ]
                    ),
                    2
                )

            water_trend.append({
                "date":
                    date,

                "water_risk":
                    values[
                        "water_risk"
                    ],

                "ph":
                    average_ph,

                "tests":
                    values[
                        "tests"
                    ],

                "unsafe":
                    values[
                        "unsafe"
                    ],
            })

    # ========================================================
    # RAINFALL / FLOOD TREND
    # ========================================================

    rainfall_records = (
        db.query(models.RainfallData)
        .filter(
            models.RainfallData.village_id ==
            village_id
        )
        .order_by(
            models.RainfallData.created_at.asc()
        )
        .all()
    )

    rainfall_grouped = defaultdict(
        lambda: {
            "rainfall_mm": 0,
            "rainfall_risk": 0,
            "flood_risk": False,
            "records": 0,
        }
    )

    for record in rainfall_records:

        if not record.created_at:
            continue

        date_key = (
            record.created_at
            .date()
            .isoformat()
        )

        rainfall_grouped[
            date_key
        ]["rainfall_mm"] = max(
            rainfall_grouped[
                date_key
            ]["rainfall_mm"],

            record.rainfall_mm
            or 0
        )

        rainfall_grouped[
            date_key
        ]["rainfall_risk"] = max(
            rainfall_grouped[
                date_key
            ]["rainfall_risk"],

            calculate_rainfall_score(
                record
            )
        )

        if record.flood_risk:

            rainfall_grouped[
                date_key
            ]["flood_risk"] = True

        rainfall_grouped[
            date_key
        ]["records"] += 1

    rainfall_trend = [
        {
            "date":
                date,

            "rainfall_mm":
                values[
                    "rainfall_mm"
                ],

            "rainfall_risk":
                values[
                    "rainfall_risk"
                ],

            "flood_risk":
                values[
                    "flood_risk"
                ],

            "records":
                values[
                    "records"
                ],
        }
        for date, values
        in sorted(
            rainfall_grouped.items()
        )
    ]

    # ========================================================
    # OUTPUT
    # ========================================================

    return {
        "village": {
            "id":
                village.id,

            "name":
                village.name,

            "district":
                village.district,

            "population":
                village.population,
        },

        "water_source": (
            {
                "id":
                    water_source.id,

                "source_code":
                    water_source.source_code,

                "source_name":
                    water_source.source_name,

                "source_type":
                    water_source.source_type,
            }
            if water_source
            else None
        ),

        "health_trend":
            health_trend,

        "water_trend":
            water_trend,

        "rainfall_trend":
            rainfall_trend,

        "record_counts": {
            "health":
                len(health_records),

            "water":
                (
                    sum(
                        item["tests"]
                        for item
                        in water_trend
                    )
                    if water_trend
                    else 0
                ),

            "rainfall":
                len(rainfall_records),
        },

        "data_note": (
            "Historical trend view uses the "
            "prototype dataset. Illustrative "
            "health and environmental observations "
            "must not be presented as official "
            "village-level government measurements."
        ),
    }


# ============================================================
# CREATE INTERVENTION
# ============================================================

@app.post("/interventions")
def create_intervention(
    intervention: InterventionCreate,
    db: Session = Depends(get_db)
):
    village = (
        db.query(models.Village)
        .filter(
            models.Village.id ==
            intervention.village_id
        )
        .first()
    )

    if not village:
        raise HTTPException(
            status_code=404,
            detail="Village not found"
        )

    source = None

    if intervention.water_source_id:

        source = (
            db.query(models.WaterSource)
            .filter(
                models.WaterSource.id ==
                intervention.water_source_id
            )
            .first()
        )

        if not source:
            raise HTTPException(
                status_code=404,
                detail="Water source not found"
            )

    record = models.Intervention(
        village_id=
            intervention.village_id,

        water_source_id=
            intervention.water_source_id,

        priority_level=
            intervention.priority_level,

        intervention_type=
            intervention.intervention_type,

        status=
            "Detected",

        assigned_to=
            intervention.assigned_to,

        action_notes=
            intervention.action_notes,
    )

    db.add(record)
    db.commit()
    db.refresh(record)

    return {
        "message":
            "Intervention case created successfully",

        "intervention_id":
            record.id,

        "village":
            village.name,

        "water_source":
            source.source_code
            if source
            else None,

        "priority_level":
            record.priority_level,

        "status":
            record.status,
    }


# ============================================================
# GET INTERVENTIONS
# ============================================================

@app.get("/interventions")
def get_interventions(
    db: Session = Depends(get_db)
):
    interventions = (
        db.query(models.Intervention)
        .order_by(
            models.Intervention.created_at.desc()
        )
        .all()
    )

    result = []

    for item in interventions:

        village = (
            db.query(models.Village)
            .filter(
                models.Village.id ==
                item.village_id
            )
            .first()
        )

        source = None

        if item.water_source_id:

            source = (
                db.query(models.WaterSource)
                .filter(
                    models.WaterSource.id ==
                    item.water_source_id
                )
                .first()
            )

        result.append({
            "id":
                item.id,

            "village_id":
                item.village_id,

            "village":
                village.name
                if village
                else "Unknown",

            "water_source_id":
                item.water_source_id,

            "water_source":
                source.source_code
                if source
                else None,

            "priority_level":
                item.priority_level,

            "intervention_type":
                item.intervention_type,

            "status":
                item.status,

            "assigned_to":
                item.assigned_to,

            "action_notes":
                item.action_notes,

            "outcome_notes":
                item.outcome_notes,

            "created_at":
                item.created_at,

            "updated_at":
                item.updated_at,
        })

    return result


# ============================================================
# UPDATE INTERVENTION
# ============================================================

@app.put("/interventions/{intervention_id}")
def update_intervention(
    intervention_id: int,
    update: InterventionUpdate,
    db: Session = Depends(get_db)
):
    allowed_statuses = [
        "Detected",
        "Investigation Started",
        "Water Source Verified",
        "Intervention Taken",
        "Resolved",
        "Outcome Verified",
    ]

    if update.status not in allowed_statuses:

        raise HTTPException(
            status_code=400,
            detail="Invalid intervention status"
        )

    intervention = (
        db.query(models.Intervention)
        .filter(
            models.Intervention.id ==
            intervention_id
        )
        .first()
    )

    if not intervention:

        raise HTTPException(
            status_code=404,
            detail="Intervention not found"
        )

    intervention.status = (
        update.status
    )

    if update.assigned_to is not None:
        intervention.assigned_to = (
            update.assigned_to
        )

    if update.action_notes is not None:
        intervention.action_notes = (
            update.action_notes
        )

    if update.outcome_notes is not None:
        intervention.outcome_notes = (
            update.outcome_notes
        )

    db.commit()
    db.refresh(intervention)

    return {
        "message":
            "Intervention updated successfully",

        "intervention_id":
            intervention.id,

        "status":
            intervention.status,

        "assigned_to":
            intervention.assigned_to,

        "outcome_notes":
            intervention.outcome_notes,
    }
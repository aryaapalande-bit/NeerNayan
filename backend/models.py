from datetime import datetime

from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Boolean,
    DateTime,
    ForeignKey,
)

from sqlalchemy.orm import relationship

from database import Base


# ============================================================
# VILLAGE
# ============================================================

class Village(Base):
    __tablename__ = "villages"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    name = Column(
        String,
        unique=True,
        nullable=False
    )

    district = Column(
        String,
        nullable=False
    )

    state = Column(
        String,
        nullable=False
    )

    population = Column(
        Integer,
        nullable=True
    )

    latitude = Column(
        Float,
        nullable=True
    )

    longitude = Column(
        Float,
        nullable=True
    )


# ============================================================
# WATER SOURCE
# ============================================================

class WaterSource(Base):
    __tablename__ = "water_sources"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    source_code = Column(
        String,
        unique=True,
        nullable=False
    )

    source_name = Column(
        String,
        nullable=False
    )

    source_type = Column(
        String,
        nullable=True
    )

    latitude = Column(
        Float,
        nullable=True
    )

    longitude = Column(
        Float,
        nullable=True
    )


# ============================================================
# VILLAGE ↔ WATER SOURCE LINK
# ============================================================

class VillageWaterLink(Base):
    __tablename__ = "village_water_links"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    village_id = Column(
        Integer,
        ForeignKey("villages.id"),
        nullable=False
    )

    water_source_id = Column(
        Integer,
        ForeignKey("water_sources.id"),
        nullable=False
    )

    village = relationship("Village")
    water_source = relationship("WaterSource")


# ============================================================
# ASHA SYMPTOM REPORT
# ============================================================

class SymptomReport(Base):
    __tablename__ = "symptom_reports"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    village_id = Column(
        Integer,
        ForeignKey("villages.id"),
        nullable=False
    )

    water_source_id = Column(
        Integer,
        ForeignKey("water_sources.id"),
        nullable=True
    )

    people_affected = Column(
        Integer,
        default=1
    )

    diarrhea = Column(Boolean, default=False)
    vomiting = Column(Boolean, default=False)
    fever = Column(Boolean, default=False)
    jaundice = Column(Boolean, default=False)

    abdominal_pain = Column(
        Boolean,
        default=False
    )

    reported_by = Column(
        String,
        default="ASHA Worker"
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )


# ============================================================
# WATER QUALITY TEST
# ============================================================

class WaterQualityTest(Base):
    __tablename__ = "water_quality_tests"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    water_source_id = Column(
        Integer,
        ForeignKey("water_sources.id"),
        nullable=False
    )

    ph = Column(
        Float,
        nullable=True
    )

    turbidity = Column(
        String,
        default="Normal"
    )

    residual_chlorine = Column(
        String,
        default="Normal"
    )

    microbial_contamination = Column(
        Boolean,
        default=False
    )

    tested_by = Column(
        String,
        default="Field Water Quality Worker"
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )


# ============================================================
# RAINFALL DATA
# ============================================================

class RainfallData(Base):
    __tablename__ = "rainfall_data"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    village_id = Column(
        Integer,
        ForeignKey("villages.id"),
        nullable=False
    )

    rainfall_mm = Column(
        Float,
        default=0
    )

    rainfall_level = Column(
        String,
        default="Normal"
    )

    flood_risk = Column(
        Boolean,
        default=False
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )


# ============================================================
# ALERT
# ============================================================

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    village_id = Column(
        Integer,
        ForeignKey("villages.id"),
        nullable=True
    )

    water_source_id = Column(
        Integer,
        ForeignKey("water_sources.id"),
        nullable=True
    )

    alert_type = Column(
        String,
        nullable=False
    )

    risk_score = Column(
        Integer,
        default=0
    )

    risk_level = Column(
        String,
        default="Normal"
    )

    evidence_strength = Column(
        String,
        nullable=True
    )

    description = Column(
        String,
        nullable=True
    )

    status = Column(
        String,
        default="Detected"
    )

    confirmed = Column(
        Boolean,
        nullable=True
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )


# ============================================================
# CITIZEN SELF REPORT
# ============================================================

class CitizenReport(Base):
    __tablename__ = "citizen_reports"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    village_id = Column(
        Integer,
        ForeignKey("villages.id"),
        nullable=False
    )

    people_affected = Column(
        Integer,
        default=1
    )

    diarrhea = Column(Boolean, default=False)
    vomiting = Column(Boolean, default=False)
    fever = Column(Boolean, default=False)
    jaundice = Column(Boolean, default=False)

    abdominal_pain = Column(
        Boolean,
        default=False
    )

    symptom_start = Column(
        String,
        nullable=True
    )

    used_community_water = Column(
        Boolean,
        default=True
    )

    reporter_name = Column(
        String,
        nullable=True
    )

    verification_status = Column(
        String,
        default="Unverified"
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )


# ============================================================
# GOVERNMENT INTERVENTION
# ============================================================

class Intervention(Base):
    __tablename__ = "interventions"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    village_id = Column(
        Integer,
        ForeignKey("villages.id"),
        nullable=False
    )

    water_source_id = Column(
        Integer,
        ForeignKey("water_sources.id"),
        nullable=True
    )

    priority_level = Column(
        String,
        default="Medium"
    )

    intervention_type = Column(
        String,
        default="Field Investigation"
    )

    status = Column(
        String,
        default="Detected"
    )

    assigned_to = Column(
        String,
        nullable=True
    )

    action_notes = Column(
        String,
        nullable=True
    )

    outcome_notes = Column(
        String,
        nullable=True
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )

    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )
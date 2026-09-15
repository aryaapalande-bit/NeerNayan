from database import SessionLocal
from models import (
    Village,
    WaterSource,
    SymptomReport,
    WaterQualityTest,
    RainfallData
)

db = SessionLocal()


def seed_scenario():

    # --------------------------------------------------------
    # GET VILLAGES
    # --------------------------------------------------------

    nongriat = (
        db.query(Village)
        .filter(Village.name == "Nongriat")
        .first()
    )

    laitkynsew = (
        db.query(Village)
        .filter(Village.name == "Laitkynsew")
        .first()
    )

    sohra = (
        db.query(Village)
        .filter(Village.name == "Sohra")
        .first()
    )

    # --------------------------------------------------------
    # GET WATER SOURCE S-02
    # --------------------------------------------------------

    s2 = (
        db.query(WaterSource)
        .filter(WaterSource.source_code == "S-02")
        .first()
    )

    # --------------------------------------------------------
    # CLEAR OLD SCENARIO DATA
    # --------------------------------------------------------

    db.query(SymptomReport).delete()
    db.query(WaterQualityTest).delete()
    db.query(RainfallData).delete()

    db.commit()

    # --------------------------------------------------------
    # ASHA SYMPTOM REPORTS
    # --------------------------------------------------------

    nongriat_report = SymptomReport(
        village_id=nongriat.id,
        water_source_id=s2.id,
        people_affected=7,
        diarrhea=True,
        vomiting=True,
        fever=False,
        jaundice=False,
        abdominal_pain=True,
        reported_by="ASHA Worker - Nongriat"
    )

    laitkynsew_report = SymptomReport(
        village_id=laitkynsew.id,
        water_source_id=s2.id,
        people_affected=5,
        diarrhea=True,
        vomiting=True,
        fever=False,
        jaundice=False,
        abdominal_pain=True,
        reported_by="ASHA Worker - Laitkynsew"
    )

    # Sohra deliberately has no abnormal symptom report yet

    db.add_all([
        nongriat_report,
        laitkynsew_report
    ])

    # --------------------------------------------------------
    # WATER QUALITY TEST — S-02
    # --------------------------------------------------------

    unsafe_water_test = WaterQualityTest(
        water_source_id=s2.id,
        ph=6.4,
        turbidity="High",
        residual_chlorine="Low",
        microbial_contamination=True,
        tested_by="Field Water Quality Worker"
    )

    db.add(unsafe_water_test)

    # --------------------------------------------------------
    # RAINFALL DATA
    # --------------------------------------------------------

    rainfall_nongriat = RainfallData(
        village_id=nongriat.id,
        rainfall_mm=145,
        rainfall_level="Heavy",
        flood_risk=True
    )

    rainfall_laitkynsew = RainfallData(
        village_id=laitkynsew.id,
        rainfall_mm=132,
        rainfall_level="Heavy",
        flood_risk=True
    )

    rainfall_sohra = RainfallData(
        village_id=sohra.id,
        rainfall_mm=150,
        rainfall_level="Heavy",
        flood_risk=True
    )

    db.add_all([
        rainfall_nongriat,
        rainfall_laitkynsew,
        rainfall_sohra
    ])

    db.commit()

    print("========================================")
    print("NeerNetra outbreak scenario created")
    print("========================================")
    print("")
    print("Nongriat -> 7 affected")
    print("Laitkynsew -> 5 affected")
    print("Sohra -> No symptom spike")
    print("")
    print("S-02 -> Unsafe water")
    print("Rainfall -> Heavy")
    print("")
    print("Expected NeerNetra result:")
    print("Probable Source -> S-02")
    print("Nongriat -> High Risk")
    print("Laitkynsew -> High Risk")
    print("Sohra -> Preventive Exposure Warning")


if __name__ == "__main__":
    seed_scenario()
    db.close()
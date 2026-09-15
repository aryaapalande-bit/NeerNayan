from collections import Counter
from datetime import datetime

from database import SessionLocal

import models

from risk_engine import (
    calculate_village_risk,
    detect_probable_sources,
    detect_exposed_villages,
)


# ============================================================
# HELPERS
# ============================================================

def heading(title):
    print("\n" + "=" * 60)
    print(title)
    print("=" * 60)


def pass_check(message):
    print(f"✅ PASS  {message}")


def warning(message):
    print(f"⚠️  WARN  {message}")


def fail(message):
    print(f"❌ FAIL  {message}")


# ============================================================
# MAIN VALIDATION
# ============================================================

def main():

    db = SessionLocal()

    try:

        heading("NEERNAYAN DATA VALIDATION")

        # ====================================================
        # RECORD COUNTS
        # ====================================================

        villages = (
            db.query(models.Village)
            .all()
        )

        sources = (
            db.query(models.WaterSource)
            .all()
        )

        links = (
            db.query(models.VillageWaterLink)
            .all()
        )

        health_records = (
            db.query(models.SymptomReport)
            .all()
        )

        water_tests = (
            db.query(models.WaterQualityTest)
            .all()
        )

        rainfall_records = (
            db.query(models.RainfallData)
            .all()
        )

        citizen_reports = (
            db.query(models.CitizenReport)
            .all()
        )

        interventions = (
            db.query(models.Intervention)
            .all()
        )

        print(
            f"\nVillages:          {len(villages)}"
        )

        print(
            f"Water Sources:     {len(sources)}"
        )

        print(
            f"Village Links:     {len(links)}"
        )

        print(
            f"Health Records:    {len(health_records)}"
        )

        print(
            f"Water Tests:       {len(water_tests)}"
        )

        print(
            f"Rainfall Records:  {len(rainfall_records)}"
        )

        print(
            f"Citizen Reports:   {len(citizen_reports)}"
        )

        print(
            f"Interventions:     {len(interventions)}"
        )


        # ====================================================
        # EXPECTED IMPORT COUNTS
        # ====================================================

        heading("1. IMPORT COMPLETENESS")

        if len(villages) == 40:
            pass_check(
                "All 40 villages imported."
            )
        else:
            warning(
                f"Expected 40 villages, found {len(villages)}."
            )

        if len(health_records) == 120:
            pass_check(
                "All 120 health records imported."
            )
        else:
            warning(
                f"Expected 120 health records, found {len(health_records)}."
            )

        if len(water_tests) == 120:
            pass_check(
                "All 120 water-quality records imported."
            )
        else:
            warning(
                f"Expected 120 water-quality records, found {len(water_tests)}."
            )

        if len(rainfall_records) == 50:
            pass_check(
                "All 50 rainfall/flood records imported."
            )
        else:
            warning(
                f"Expected 50 rainfall records, found {len(rainfall_records)}."
            )


        # ====================================================
        # VILLAGE QUALITY
        # ====================================================

        heading("2. VILLAGE DATA QUALITY")

        missing_population = [
            village.name
            for village in villages
            if village.population is None
        ]

        missing_coordinates = [
            village.name
            for village in villages
            if (
                village.latitude is None
                or village.longitude is None
            )
        ]

        village_names = [
            village.name
            for village in villages
        ]

        duplicate_names = [
            name
            for name, count
            in Counter(village_names).items()
            if count > 1
        ]

        if not missing_population:
            pass_check(
                "All villages have population values."
            )
        else:
            warning(
                "Missing population: "
                + ", ".join(missing_population)
            )

        if not missing_coordinates:
            pass_check(
                "All villages have map coordinates."
            )
        else:
            warning(
                "Missing coordinates: "
                + ", ".join(missing_coordinates)
            )

        if not duplicate_names:
            pass_check(
                "No duplicate village names."
            )
        else:
            warning(
                "Duplicate villages: "
                + ", ".join(duplicate_names)
            )


        # ====================================================
        # WATER-SOURCE CONNECTIONS
        # ====================================================

        heading("3. WATER-SOURCE NETWORK")

        villages_without_link = []

        for village in villages:

            link = (
                db.query(models.VillageWaterLink)
                .filter(
                    models.VillageWaterLink.village_id
                    == village.id
                )
                .first()
            )

            if not link:
                villages_without_link.append(
                    village.name
                )

        if not villages_without_link:
            pass_check(
                "Every village has a drinking-water source link."
            )
        else:
            fail(
                "Villages without water-source link: "
                + ", ".join(villages_without_link)
            )

        source_connections = Counter(
            link.water_source_id
            for link in links
        )

        shared_sources = [
            source_id
            for source_id, count
            in source_connections.items()
            if count >= 2
        ]

        print(
            f"\nShared water sources: {len(shared_sources)}"
        )

        for source_id in shared_sources:

            source = (
                db.query(models.WaterSource)
                .filter(
                    models.WaterSource.id
                    == source_id
                )
                .first()
            )

            connected_links = (
                db.query(models.VillageWaterLink)
                .filter(
                    models.VillageWaterLink.water_source_id
                    == source_id
                )
                .all()
            )

            connected_names = []

            for link in connected_links:

                village = (
                    db.query(models.Village)
                    .filter(
                        models.Village.id
                        == link.village_id
                    )
                    .first()
                )

                if village:
                    connected_names.append(
                        village.name
                    )

            print(
                f"  • {source.source_code} "
                f"{source.source_name}: "
                f"{', '.join(connected_names)}"
            )


        # ====================================================
        # HEALTH COVERAGE
        # ====================================================

        heading("4. HEALTH DATA COVERAGE")

        villages_without_health = []

        for village in villages:

            count = (
                db.query(models.SymptomReport)
                .filter(
                    models.SymptomReport.village_id
                    == village.id
                )
                .count()
            )

            if count == 0:
                villages_without_health.append(
                    village.name
                )

        if not villages_without_health:
            pass_check(
                "Every village has historical health data."
            )
        else:
            warning(
                "No health records for: "
                + ", ".join(villages_without_health)
            )

        if health_records:

            health_dates = [
                record.created_at
                for record in health_records
                if record.created_at
            ]

            if health_dates:

                print(
                    "\nHealth date range:"
                )

                print(
                    f"  {min(health_dates).date()} "
                    f"→ {max(health_dates).date()}"
                )


        # ====================================================
        # WATER QUALITY COVERAGE
        # ====================================================

        heading("5. WATER QUALITY COVERAGE")

        sources_without_tests = []

        for source in sources:

            count = (
                db.query(models.WaterQualityTest)
                .filter(
                    models.WaterQualityTest.water_source_id
                    == source.id
                )
                .count()
            )

            if count == 0:
                sources_without_tests.append(
                    source.source_code
                )

        if not sources_without_tests:
            pass_check(
                "Every drinking-water source has water-quality data."
            )
        else:
            warning(
                "Sources without tests: "
                + ", ".join(sources_without_tests)
            )

        if water_tests:

            water_dates = [
                test.created_at
                for test in water_tests
                if test.created_at
            ]

            if water_dates:

                print(
                    "\nWater-quality date range:"
                )

                print(
                    f"  {min(water_dates).date()} "
                    f"→ {max(water_dates).date()}"
                )


        # ====================================================
        # RAINFALL COVERAGE
        # ====================================================

        heading("6. RAINFALL / FLOOD COVERAGE")

        villages_without_rainfall = []

        for village in villages:

            count = (
                db.query(models.RainfallData)
                .filter(
                    models.RainfallData.village_id
                    == village.id
                )
                .count()
            )

            if count == 0:
                villages_without_rainfall.append(
                    village.name
                )

        print(
            f"\nVillages with rainfall data: "
            f"{len(villages) - len(villages_without_rainfall)}"
            f"/{len(villages)}"
        )

        if villages_without_rainfall:

            warning(
                "Some villages have no rainfall record. "
                "This is acceptable if the source dataset "
                "does not provide village-level rainfall "
                "for every location."
            )
        else:
            pass_check(
                "Every village has rainfall/flood data."
            )

        if rainfall_records:

            rainfall_dates = [
                record.created_at
                for record in rainfall_records
                if record.created_at
            ]

            if rainfall_dates:

                print(
                    "\nRainfall date range:"
                )

                print(
                    f"  {min(rainfall_dates).date()} "
                    f"→ {max(rainfall_dates).date()}"
                )


        # ====================================================
        # RISK ENGINE
        # ====================================================

        heading("7. RISK ENGINE VALIDATION")

        risk_results = []

        invalid_scores = []

        evidence_mismatches = []

        for village in villages:

            result = (
                calculate_village_risk(
                    db,
                    village
                )
            )

            risk_results.append(
                result
            )

            score = result.get(
                "risk_score",
                0
            )

            if score < 0 or score > 100:
                invalid_scores.append(
                    (
                        village.name,
                        score
                    )
                )

            evidence = result.get(
                "evidence",
                {}
            )

            evidence_total = (
                evidence.get(
                    "health",
                    0
                )
                + evidence.get(
                    "water",
                    0
                )
                + evidence.get(
                    "shared",
                    0
                )
                + evidence.get(
                    "rainfall",
                    0
                )
            )

            expected_score = min(
                evidence_total,
                100
            )

            if expected_score != score:

                evidence_mismatches.append(
                    (
                        village.name,
                        score,
                        expected_score
                    )
                )

        if not invalid_scores:
            pass_check(
                "All village risk scores are within 0–100."
            )
        else:
            fail(
                f"{len(invalid_scores)} invalid risk scores detected."
            )

        if not evidence_mismatches:
            pass_check(
                "All risk scores match their explainable evidence components."
            )
        else:
            fail(
                f"{len(evidence_mismatches)} evidence-score mismatches detected."
            )


        # ====================================================
        # RISK DISTRIBUTION
        # ====================================================

        risk_distribution = Counter(
            result["risk_level"]
            for result in risk_results
        )

        print(
            "\nRisk distribution:"
        )

        for level in [
            "Normal",
            "Watch",
            "Investigate",
            "Priority"
        ]:

            print(
                f"  {level:<12}: "
                f"{risk_distribution.get(level, 0)}"
            )

        highest_risk = sorted(
            risk_results,
            key=lambda item:
                item["risk_score"],
            reverse=True
        )[:10]

        print(
            "\nTop 10 risk-ranked villages:"
        )

        for index, result in enumerate(
            highest_risk,
            start=1
        ):

            print(
                f"  {index:>2}. "
                f"{result['village']:<25} "
                f"{result['risk_score']:>3}/100 "
                f"{result['risk_level']}"
            )


        # ====================================================
        # SOURCE ATTRIBUTION
        # ====================================================

        heading("8. SOURCE ATTRIBUTION")

        probable_sources = (
            detect_probable_sources(
                db
            )
        )

        exposure_warnings = (
            detect_exposed_villages(
                db
            )
        )

        print(
            f"\nProbable contamination sources: "
            f"{len(probable_sources)}"
        )

        for source in probable_sources:

            print(
                f"\n  • {source['source_code']} "
                f"{source['source_name']}"
            )

            print(
                "    Evidence: "
                f"{source['evidence_strength']}"
            )

            print(
                "    Villages: "
                + ", ".join(
                    source[
                        "affected_villages"
                    ]
                )
            )

        print(
            f"\nPreventive exposure warnings: "
            f"{len(exposure_warnings)}"
        )

        for item in exposure_warnings:

            print(
                f"  • {item['village']} "
                f"← {item['water_source']}"
            )


        # ====================================================
        # FINAL RESULT
        # ====================================================

        heading("VALIDATION SUMMARY")

        critical_failures = (
            len(villages) == 0
            or len(health_records) == 0
            or len(water_tests) == 0
            or len(links) == 0
            or len(invalid_scores) > 0
            or len(evidence_mismatches) > 0
            or len(villages_without_link) > 0
        )

        if critical_failures:

            fail(
                "Critical validation issues found. "
                "Fix them before the final demo."
            )

        else:

            pass_check(
                "Core NeerNayan dataset and risk engine "
                "are structurally ready for prototype use."
            )

            print(
                "\nNOTE:"
            )

            print(
                "The integrated workbook contains "
                "illustrative prototype observations."
            )

            print(
                "Present them as demo/hybrid data, "
                "not verified official village-level "
                "epidemiological measurements."
            )


    finally:

        db.close()


if __name__ == "__main__":
    main()
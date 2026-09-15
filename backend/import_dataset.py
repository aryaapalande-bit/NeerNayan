import os
import shutil
from datetime import datetime

import pandas as pd

from database import SessionLocal, engine
import models


# ============================================================
# CONFIGURATION
# ============================================================

BASE_DIR = os.path.dirname(
    os.path.dirname(
        os.path.abspath(__file__)
    )
)

DATA_FILE = os.path.join(
    BASE_DIR,
    "data",
    "neernayan_dataset.xlsx"
)

BACKEND_DIR = os.path.dirname(
    os.path.abspath(__file__)
)

DATABASE_FILE = os.path.join(
    BACKEND_DIR,
    "neernayan.db"
)

BACKUP_DIR = os.path.join(
    BACKEND_DIR,
    "database_backups"
)


# ============================================================
# CREATE TABLES
# ============================================================

models.Base.metadata.create_all(
    bind=engine
)


# ============================================================
# MONTH → DATE
# ============================================================

MONTH_NUMBERS = {
    "January": 1,
    "February": 2,
    "March": 3,
    "April": 4,
    "May": 5,
    "June": 6,
    "July": 7,
    "August": 8,
    "September": 9,
    "October": 10,
    "November": 11,
    "December": 12,
}


# ============================================================
# DATABASE BACKUP
# ============================================================

def backup_database():

    if not os.path.exists(DATABASE_FILE):
        print(
            "No existing neernayan.db found."
        )
        return

    os.makedirs(
        BACKUP_DIR,
        exist_ok=True
    )

    timestamp = datetime.now().strftime(
        "%Y%m%d_%H%M%S"
    )

    backup_file = os.path.join(
        BACKUP_DIR,
        f"neernayan_before_dataset_{timestamp}.db"
    )

    shutil.copy2(
        DATABASE_FILE,
        backup_file
    )

    print(
        f"Database backup created:\n{backup_file}"
    )


# ============================================================
# CLEAR OLD DATA
# ============================================================

def clear_database(db):

    print(
        "\nClearing old prototype data..."
    )

    # Delete dependent tables first

    db.query(
        models.Intervention
    ).delete()

    db.query(
        models.Alert
    ).delete()

    db.query(
        models.CitizenReport
    ).delete()

    db.query(
        models.SymptomReport
    ).delete()

    db.query(
        models.WaterQualityTest
    ).delete()

    db.query(
        models.RainfallData
    ).delete()

    db.query(
        models.VillageWaterLink
    ).delete()

    db.query(
        models.WaterSource
    ).delete()

    db.query(
        models.Village
    ).delete()

    db.commit()

    print(
        "Old prototype records removed."
    )


# ============================================================
# SAFE STRING
# ============================================================

def clean_text(value):

    if pd.isna(value):
        return ""

    return str(value).strip()


# ============================================================
# HEALTH → SYMPTOM FLAGS
# ============================================================

def symptom_flags(
    disease,
    symptoms
):

    combined = (
        f"{disease} {symptoms}"
        .lower()
    )

    diarrhea = any(
        keyword in combined
        for keyword in [
            "diarrhoea",
            "diarrhea",
            "watery stools",
            "cholera",
            "acute diarrhoeal",
        ]
    )

    vomiting = any(
        keyword in combined
        for keyword in [
            "vomiting",
            "vomit",
            "nausea",
        ]
    )

    fever = any(
        keyword in combined
        for keyword in [
            "fever",
            "typhoid",
        ]
    )

    jaundice = any(
        keyword in combined
        for keyword in [
            "jaundice",
            "hepatitis",
            "dark-coloured urine",
        ]
    )

    abdominal_pain = any(
        keyword in combined
        for keyword in [
            "abdominal",
            "cramp",
            "stomach pain",
        ]
    )

    return {
        "diarrhea":
            diarrhea,

        "vomiting":
            vomiting,

        "fever":
            fever,

        "jaundice":
            jaundice,

        "abdominal_pain":
            abdominal_pain,
    }


# ============================================================
# TURBIDITY CATEGORY
# ============================================================

def turbidity_category(value):

    if pd.isna(value):
        return "Unknown"

    value = float(value)

    if value <= 5:
        return "Normal"

    if value <= 10:
        return "Moderate"

    return "High"


# ============================================================
# CHLORINE CATEGORY
# ============================================================

def chlorine_category(value):

    if pd.isna(value):
        return "Unknown"

    value = float(value)

    if value < 0.2:
        return "Low"

    if value <= 0.5:
        return "Normal"

    return "High"


# ============================================================
# SOURCE SHARING LOGIC
# ============================================================

def get_source_group_key(row):

    source_name = clean_text(
        row[
            "Drinking_Water_Source_Name"
        ]
    )

    district = clean_text(
        row["District"]
    )

    sharing_note = clean_text(
        row[
            "Other_Villages_Sharing_Same_Source"
        ]
    ).lower()

    # Explicitly independent source
    if (
        "independent" in sharing_note
        or "standalone" in sharing_note
        or sharing_note == ""
    ):
        return (
            f"{source_name}"
            f"__{clean_text(row['Village_ID'])}"
        )

    # Exact generic river-channel cluster in dataset
    if source_name == "Local river channel":
        return (
            "Local river channel"
            "__West Garo Hills cluster"
        )

    # Two Community Stream villages explicitly share one another
    if source_name == "Community stream":
        return (
            "Community stream"
            "__Ri Bhoi cluster"
        )

    # All other sources kept village-specific
    # unless the exact source name is clearly unique.
    return (
        f"{source_name}"
        f"__{clean_text(row['Village_ID'])}"
    )


# ============================================================
# IMPORT VILLAGES + SOURCES
# ============================================================

def import_villages(
    db,
    villages_df
):

    print(
        "\nImporting villages and water sources..."
    )

    village_map = {}
    source_map = {}

    for _, row in villages_df.iterrows():

        external_village_id = clean_text(
            row["Village_ID"]
        )

        village = models.Village(
            name=
                clean_text(
                    row["Village_Name"]
                ),

            district=
                clean_text(
                    row["District"]
                ),

            state=
                "Meghalaya",

            population=
                (
                    int(row["Population"])
                    if not pd.isna(
                        row["Population"]
                    )
                    else None
                ),

            latitude=
                (
                    float(row["Latitude"])
                    if not pd.isna(
                        row["Latitude"]
                    )
                    else None
                ),

            longitude=
                (
                    float(row["Longitude"])
                    if not pd.isna(
                        row["Longitude"]
                    )
                    else None
                ),
        )

        db.add(village)
        db.flush()

        village_map[
            external_village_id
        ] = village.id

        source_key = (
            get_source_group_key(row)
        )

        if source_key not in source_map:

            source = models.WaterSource(
                source_code=
                    f"S-{len(source_map)+1:03}",

                source_name=
                    clean_text(
                        row[
                            "Drinking_Water_Source_Name"
                        ]
                    ),

                source_type=
                    clean_text(
                        row[
                            "Water_Source_Type"
                        ]
                    ),

                latitude=
                    (
                        float(row["Latitude"])
                        if not pd.isna(
                            row["Latitude"]
                        )
                        else None
                    ),

                longitude=
                    (
                        float(row["Longitude"])
                        if not pd.isna(
                            row["Longitude"]
                        )
                        else None
                    ),
            )

            db.add(source)
            db.flush()

            source_map[
                source_key
            ] = source.id

        water_source_id = (
            source_map[source_key]
        )

        link = models.VillageWaterLink(
            village_id=
                village.id,

            water_source_id=
                water_source_id,
        )

        db.add(link)

    db.commit()

    print(
        f"Villages imported: "
        f"{len(village_map)}"
    )

    print(
        f"Water sources created: "
        f"{len(source_map)}"
    )

    return (
        village_map,
        source_map
    )


# ============================================================
# IMPORT HEALTH DATA
# ============================================================

def import_health_data(
    db,
    health_df,
    village_map
):

    print(
        "\nImporting health records..."
    )

    count = 0

    for _, row in health_df.iterrows():

        external_id = clean_text(
            row["Village_ID"]
        )

        village_id = (
            village_map.get(
                external_id
            )
        )

        if not village_id:
            continue

        water_link = (
            db.query(
                models.VillageWaterLink
            )
            .filter(
                models.VillageWaterLink.village_id
                == village_id
            )
            .first()
        )

        symptoms = symptom_flags(
            clean_text(
                row["Disease"]
            ),

            clean_text(
                row["Symptoms"]
            ),
        )

        month_name = clean_text(
            row["Month"]
        )

        month_number = (
            MONTH_NUMBERS.get(
                month_name,
                1
            )
        )

        year = int(
            row["Year"]
        )

        record_date = datetime(
            year,
            month_number,
            15
        )

        report = models.SymptomReport(
            village_id=
                village_id,

            water_source_id=
                (
                    water_link.water_source_id
                    if water_link
                    else None
                ),

            people_affected=
                int(
                    row[
                        "Number_of_Cases"
                    ]
                ),

            diarrhea=
                symptoms[
                    "diarrhea"
                ],

            vomiting=
                symptoms[
                    "vomiting"
                ],

            fever=
                symptoms[
                    "fever"
                ],

            jaundice=
                symptoms[
                    "jaundice"
                ],

            abdominal_pain=
                symptoms[
                    "abdominal_pain"
                ],

            reported_by=
                (
                    "Historical Dataset "
                    "(Illustrative)"
                ),

            created_at=
                record_date,
        )

        db.add(report)

        count += 1

    db.commit()

    print(
        f"Health records imported: "
        f"{count}"
    )


# ============================================================
# IMPORT WATER QUALITY
# ============================================================

def import_water_quality(
    db,
    water_df,
    village_map
):

    print(
        "\nImporting water-quality records..."
    )

    count = 0

    for _, row in water_df.iterrows():

        external_id = clean_text(
            row["Village_ID"]
        )

        village_id = (
            village_map.get(
                external_id
            )
        )

        if not village_id:
            continue

        water_link = (
            db.query(
                models.VillageWaterLink
            )
            .filter(
                models.VillageWaterLink.village_id
                == village_id
            )
            .first()
        )

        if not water_link:
            continue

        status = clean_text(
            row["Status"]
        ).lower()

        water_test = (
            models.WaterQualityTest(
                water_source_id=
                    water_link.water_source_id,

                ph=
                    (
                        float(row["pH"])
                        if not pd.isna(
                            row["pH"]
                        )
                        else None
                    ),

                turbidity=
                    turbidity_category(
                        row[
                            "Turbidity_NTU"
                        ]
                    ),

                residual_chlorine=
                    chlorine_category(
                        row[
                            "Residual_Chlorine_mgL"
                        ]
                    ),

                # The workbook contains
                # Safe / Unsafe status but no
                # microbiological lab column.
                #
                # Therefore we DO NOT assume
                # "Unsafe" means microbial
                # contamination.
                microbial_contamination=
                    False,

                tested_by=
                    (
                        "Historical Dataset "
                        f"({status.title()})"
                    ),

                created_at=
                    pd.to_datetime(
                        row["Date"]
                    ).to_pydatetime(),
            )
        )

        db.add(water_test)

        count += 1

    db.commit()

    print(
        f"Water-quality records imported: "
        f"{count}"
    )


# ============================================================
# IMPORT RAINFALL / FLOOD DATA
# ============================================================

def import_rainfall(
    db,
    rainfall_df,
    village_map
):

    print(
        "\nImporting rainfall/flood records..."
    )

    count = 0

    for _, row in rainfall_df.iterrows():

        external_id = clean_text(
            row["Village_ID"]
        )

        village_id = (
            village_map.get(
                external_id
            )
        )

        if not village_id:
            continue

        flood_occurred = (
            clean_text(
                row["Flood_Occurred"]
            ).lower()
            == "yes"
        )

        rainfall = models.RainfallData(
            village_id=
                village_id,

            rainfall_mm=
                float(
                    row["Rainfall_mm"]
                ),

            rainfall_level=
                clean_text(
                    row[
                        "Flood_Risk_Level"
                    ]
                ),

            flood_risk=
                flood_occurred
                or clean_text(
                    row[
                        "Flood_Risk_Level"
                    ]
                ).lower()
                == "high",

            created_at=
                pd.to_datetime(
                    row["Date"]
                ).to_pydatetime(),
        )

        db.add(rainfall)

        count += 1

    db.commit()

    print(
        f"Rainfall/flood records imported: "
        f"{count}"
    )


# ============================================================
# MAIN
# ============================================================

def main():

    print(
        "\n========================================"
    )

    print(
        "NEERNAYAN DATASET IMPORT"
    )

    print(
        "========================================\n"
    )

    if not os.path.exists(DATA_FILE):

        print(
            "ERROR: Dataset file not found."
        )

        print(
            "\nExpected location:"
        )

        print(
            DATA_FILE
        )

        print(
            "\nRename your workbook to:"
        )

        print(
            "neernayan_dataset.xlsx"
        )

        return

    print(
        f"Dataset found:\n{DATA_FILE}"
    )

    # --------------------------------------------------------
    # READ EXCEL
    # --------------------------------------------------------

    workbook = pd.ExcelFile(
        DATA_FILE
    )

    required_sheets = [
        "Villages",
        "Health_Data",
        "Water_Quality",
        "Rainfall_Flood_Data",
    ]

    missing_sheets = [
        sheet
        for sheet in required_sheets
        if sheet not in workbook.sheet_names
    ]

    if missing_sheets:

        print(
            "\nERROR: Missing sheets:"
        )

        for sheet in missing_sheets:
            print(
                f"- {sheet}"
            )

        return

    villages_df = pd.read_excel(
        DATA_FILE,
        sheet_name="Villages"
    )

    health_df = pd.read_excel(
        DATA_FILE,
        sheet_name="Health_Data"
    )

    water_df = pd.read_excel(
        DATA_FILE,
        sheet_name="Water_Quality"
    )

    rainfall_df = pd.read_excel(
        DATA_FILE,
        sheet_name="Rainfall_Flood_Data"
    )

    print(
        "\nWorkbook loaded successfully."
    )

    print(
        f"Villages: {len(villages_df)}"
    )

    print(
        f"Health records: {len(health_df)}"
    )

    print(
        f"Water-quality records: "
        f"{len(water_df)}"
    )

    print(
        f"Rainfall records: "
        f"{len(rainfall_df)}"
    )

    # --------------------------------------------------------
    # BACKUP
    # --------------------------------------------------------

    backup_database()

    # --------------------------------------------------------
    # DATABASE SESSION
    # --------------------------------------------------------

    db = SessionLocal()

    try:

        clear_database(db)

        (
            village_map,
            source_map
        ) = import_villages(
            db,
            villages_df
        )

        import_health_data(
            db,
            health_df,
            village_map
        )

        import_water_quality(
            db,
            water_df,
            village_map
        )

        import_rainfall(
            db,
            rainfall_df,
            village_map
        )

        print(
            "\n========================================"
        )

        print(
            "DATASET IMPORT COMPLETED"
        )

        print(
            "========================================"
        )

        print(
            f"\nVillages: "
            f"{len(village_map)}"
        )

        print(
            f"Water Sources: "
            f"{len(source_map)}"
        )

        print(
            f"Health Records: "
            f"{len(health_df)}"
        )

        print(
            f"Water Tests: "
            f"{len(water_df)}"
        )

        print(
            f"Rainfall Records: "
            f"{len(rainfall_df)}"
        )

        print(
            "\nNeerNayan database is now "
            "using the uploaded dataset."
        )

    except Exception as error:

        db.rollback()

        print(
            "\nIMPORT FAILED"
        )

        print(
            str(error)
        )

        raise

    finally:

        db.close()


if __name__ == "__main__":
    main()
from database import SessionLocal, engine
from models import (
    Base,
    Village,
    WaterSource,
    VillageWaterLink
)

# Create tables if they don't exist
Base.metadata.create_all(bind=engine)

db = SessionLocal()


def seed_data():
    # --------------------------------------------------------
    # Clear old demo data
    # --------------------------------------------------------
    db.query(VillageWaterLink).delete()
    db.query(Village).delete()
    db.query(WaterSource).delete()
    db.commit()

    # --------------------------------------------------------
    # CREATE WATER SOURCES
    # --------------------------------------------------------
    s1 = WaterSource(
        source_code="S-01",
        source_name="Community Spring 01",
        source_type="Spring",
        latitude=25.2020,
        longitude=91.9120
    )

    s2 = WaterSource(
        source_code="S-02",
        source_name="Hill Spring 02",
        source_type="Spring",
        latitude=25.2600,
        longitude=91.6890
    )

    s3 = WaterSource(
        source_code="S-03",
        source_name="Community Well 03",
        source_type="Well",
        latitude=25.2850,
        longitude=91.6500
    )

    db.add_all([s1, s2, s3])
    db.commit()

    db.refresh(s1)
    db.refresh(s2)
    db.refresh(s3)

    # --------------------------------------------------------
    # CREATE VILLAGES
    # --------------------------------------------------------
    mawlynnong = Village(
        name="Mawlynnong",
        district="East Khasi Hills",
        state="Meghalaya",
        population=900,
        latitude=25.2011,
        longitude=91.9160
    )

    riwai = Village(
        name="Riwai",
        district="East Khasi Hills",
        state="Meghalaya",
        population=650,
        latitude=25.2045,
        longitude=91.9085
    )

    nongriat = Village(
        name="Nongriat",
        district="East Khasi Hills",
        state="Meghalaya",
        population=780,
        latitude=25.2622,
        longitude=91.6847
    )

    laitkynsew = Village(
        name="Laitkynsew",
        district="East Khasi Hills",
        state="Meghalaya",
        population=720,
        latitude=25.2588,
        longitude=91.6950
    )

    mawsynram = Village(
        name="Mawsynram",
        district="East Khasi Hills",
        state="Meghalaya",
        population=1100,
        latitude=25.2977,
        longitude=91.5825
    )

    sohra = Village(
        name="Sohra",
        district="East Khasi Hills",
        state="Meghalaya",
        population=1250,
        latitude=25.2702,
        longitude=91.7320
    )

    db.add_all([
        mawlynnong,
        riwai,
        nongriat,
        laitkynsew,
        mawsynram,
        sohra
    ])

    db.commit()

    # Refresh to get IDs
    for village in [
        mawlynnong,
        riwai,
        nongriat,
        laitkynsew,
        mawsynram,
        sohra
    ]:
        db.refresh(village)

    # --------------------------------------------------------
    # CREATE VILLAGE ↔ WATER SOURCE LINKS
    # --------------------------------------------------------

    links = [
        # S-01
        VillageWaterLink(
            village_id=mawlynnong.id,
            water_source_id=s1.id
        ),
        VillageWaterLink(
            village_id=riwai.id,
            water_source_id=s1.id
        ),

        # S-02
        VillageWaterLink(
            village_id=nongriat.id,
            water_source_id=s2.id
        ),
        VillageWaterLink(
            village_id=laitkynsew.id,
            water_source_id=s2.id
        ),
        VillageWaterLink(
            village_id=sohra.id,
            water_source_id=s2.id
        ),

        # S-03
        VillageWaterLink(
            village_id=mawsynram.id,
            water_source_id=s3.id
        )
    ]

    db.add_all(links)
    db.commit()

    print("========================================")
    print("NeerNetra demo data created successfully")
    print("========================================")
    print("")
    print("S-01 -> Mawlynnong, Riwai")
    print("S-02 -> Nongriat, Laitkynsew, Sohra")
    print("S-03 -> Mawsynram")


if __name__ == "__main__":
    seed_data()
    db.close()
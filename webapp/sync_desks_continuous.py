# webapp/sync_desks_continuous.py

import time
from datetime import datetime

import requests
from apscheduler.schedulers.background import BackgroundScheduler

from db import SessionLocal
from crud.desk_crud import add_or_update_desk

import main

def sync_desks_to_db(*args, **kwargs):
    db = SessionLocal()
    try:
        desks = requests.get(
            f"{main.SIMULATOR_URL}/api/v2/{main.API_KEY}/desks"
            
        ).json()
        

        for desk_id in desks:
            desk_data = requests.get(
                f"{main.SIMULATOR_URL}/api/v2/{main.API_KEY}/desks/{desk_id}"
            ).json()
            

            # Update desk in database
            add_or_update_desk(
                db,
                desk_id,
                {
                    "desk_data": desk_data,  # wrapped to match CRUD expectations
                    "user": "active",
                },
            )

            # Print confirmation with timestamp
            print(
                f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] "
                f"Updated desk {desk_id} in database."
            )

    except Exception as e:
        print(
            f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] "
            f"Error syncing desks: {e}"
        )
    finally:
        db.close()

def safe_sync_desks_to_db():
    try:
        sync_desks_to_db()
    except Exception as e:
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] "
              f"Error in scheduled job: {e}")

if __name__ == "__main__":
    scheduler = BackgroundScheduler()

    # Run the sync every 5 seconds (adjustable)
    scheduler.add_job(safe_sync_desks_to_db(), "interval", seconds=5)
    scheduler.start()

    print(
        f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] "
        "Continuous desk sync started... Press Ctrl+C to stop."
    )

    # Keep the script alive
    try:
        while True:
            time.sleep(1)
    except (KeyboardInterrupt, SystemExit):
        scheduler.shutdown()
        print(
            f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] "
            "Sync stopped."
        )

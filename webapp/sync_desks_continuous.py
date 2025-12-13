# sync_desks_continuous.py
import requests
from db import SessionLocal
from crud.desk_crud import add_or_update_desk
import main
from apscheduler.schedulers.background import BackgroundScheduler
import time
from datetime import datetime

def sync_desks_to_db():
    db = SessionLocal()
    try:
        desks = requests.get(f"{main.SIMULATOR_URL}/api/v2/{main.API_KEY}/desks").json()
        for desk_id in desks:
            desk_data = requests.get(f"{main.SIMULATOR_URL}/api/v2/{main.API_KEY}/desks/{desk_id}").json()
            
            # Update desk in database
            add_or_update_desk(
                db,
                desk_id,
                {
                    "desk_data": desk_data,  # wrap it in "desk_data" to match CRUD
                    "user": "active"
                }
            )
            # Print confirmation with timestamp
            print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Updated desk {desk_id} in database.")
    except Exception as e:
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Error syncing desks: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    scheduler = BackgroundScheduler()
    # Run the sync every 5 seconds (adjustable)
    scheduler.add_job(sync_desks_to_db, 'interval', seconds=5)
    scheduler.start()
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Continuous desk sync started... Press Ctrl+C to stop.")

    # Keep the script alive
    try:
        while True:
            time.sleep(1)
    except (KeyboardInterrupt, SystemExit):
        scheduler.shutdown()
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Sync stopped.")

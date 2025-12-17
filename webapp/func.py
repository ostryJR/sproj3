import json
import requests
from pathlib import Path


def schedule(scheduler, simulator_url, api_key):
    """
    Schedule desk movements using the provided scheduler.
    
    Args:
        scheduler: A BackgroundScheduler instance.
        simulator_url: Base URL of the simulator API.
        api_key: API key for simulator authentication.
    """
    def job(height, desk_id):
        res = requests.put(
            f"{simulator_url}/api/v2/{api_key}/desks/{desk_id}/state",
            json={"position_mm": height}
        )
        # Optional debug:
        # print(f"Desk {desk_id} moved to {height}mm")
        # print(res.json())

    # Load schedule config
    BASE_DIR = Path(__file__).resolve().parent
    config_path = BASE_DIR / "scheduleconfig.json"

    with open(config_path, "r") as file:
        times = json.load(file)

    # Get all desk IDs from simulator
    desks = requests.get(f"{simulator_url}/api/v2/{api_key}/desks").json()
    print("Desks found:", desks)

    # Add jobs to scheduler
    for time in times:
        hour = int(time['time'].split(':')[0])
        minute = int(time['time'].split(':')[1])
        height = int(time['height'])

        for desk_id in desks:
            job_id = f"{desk_id.replace(':', '')}_{hour}_{minute}"
            scheduler.add_job(
                job,
                'cron',
                hour=hour,
                minute=minute,
                id=job_id,
                replace_existing=True,
                args=[height, desk_id]
            )
            print(f"Scheduled job {job_id} for desk {desk_id} at {hour:02d}:{minute:02d} to height {height}")

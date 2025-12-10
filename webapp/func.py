import json
import main
import requests
from apscheduler.schedulers.background import BackgroundScheduler

# scheduler = BackgroundScheduler()
# scheduler.start()

def schedule():
    def job(height):
        requests.put(f"{main.SIMULATOR_URL}/api/v2/{main.API_KEY}/desks/{desk_id}/state", json={"position_mm": height})
    

    with open('scheduleconfig.json', 'r') as file:
        times = json.load(file)
    
    desks = requests.get(f"{main.SIMULATOR_URL}/api/v2/{main.API_KEY}/desks").json()
    print(desks)

    for time in times:
        hour = int(time['time'].split(':')[0])
        minute = int(time['time'].split(':')[1])
        height = int(time['height'])

        for desk_id in desks:
            job_id = f"{desk_id.replace(':', '')}_{hour}_{minute}"
            main.scheduler.add_job(job, 'cron', hour=hour, minute=minute, id=job_id, replace_existing=True, args=[height])
            print(f"Scheduled job {job_id} for desk {desk_id} at {hour}:{minute} to height {height}")
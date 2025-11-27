from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
import requests
import json
import os
from apscheduler.schedulers.background import BackgroundScheduler
from fastapi.middleware.cors import CORSMiddleware


SIMULATOR_URL = "http://127.0.0.1:8001"
# Build all paths relative to this file's directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
API_KEYS_FILE = os.path.join(BASE_DIR, '..', 'config', 'api_keys.json')

# Load API key
def load_api_key():
    with open(API_KEYS_FILE, "r") as f:
        keys = json.load(f)
        return keys[0]
API_KEY = load_api_key()

app = FastAPI(title="Desk Controller Web App")
scheduler = BackgroundScheduler()
scheduler.start()

app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, 'static')), name="static")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # allow JS fetch from browser
    allow_methods=["*"],
    allow_headers=["*"]
)

# Serve HTML frontend
@app.get("/", response_class=HTMLResponse)
def index():
    template_path = os.path.join(BASE_DIR, 'templates', 'index.html')
    with open(template_path, "r") as f:
        return HTMLResponse(f.read())

# List all desks
@app.get("/api/desks")
def list_desks():
    # Get list of desk IDs
    resp = requests.get(f"{SIMULATOR_URL}/api/v2/{API_KEY}/desks")
    desk_ids = resp.json()
    desks = []
    for desk_id in desk_ids:
        desk_resp = requests.get(f"{SIMULATOR_URL}/api/v2/{API_KEY}/desks/{desk_id}")
        desk_data = desk_resp.json()
        # Flatten for frontend: id, name, position_mm
        desks.append({
            "id": desk_id,
            "name": desk_data.get("config", {}).get("name", desk_id),
            "position": desk_data.get("state", {}).get("position_mm", 0)
        })
    return JSONResponse(desks)

# Move desk up
@app.post("/api/desks/{desk_id}/up")
async def desk_up(desk_id: str, request: Request):
    data = await request.json()
    step = int(data.get("step", 50))
    # Get current position
    desk_resp = requests.get(f"{SIMULATOR_URL}/api/v2/{API_KEY}/desks/{desk_id}")
    desk_data = desk_resp.json()
    current_pos = desk_data.get("state", {}).get("position_mm", 0)
    new_pos = current_pos + step
    resp = requests.put(f"{SIMULATOR_URL}/api/v2/{API_KEY}/desks/{desk_id}/state", json={"position_mm": new_pos})
    return JSONResponse(resp.json())

# Move desk down
@app.post("/api/desks/{desk_id}/down")
async def desk_down(desk_id: str, request: Request):
    data = await request.json()
    step = int(data.get("step", 50))
    # Get current position
    desk_resp = requests.get(f"{SIMULATOR_URL}/api/v2/{API_KEY}/desks/{desk_id}")
    desk_data = desk_resp.json()
    current_pos = desk_data.get("state", {}).get("position_mm", 0)
    new_pos = current_pos - step
    resp = requests.put(f"{SIMULATOR_URL}/api/v2/{API_KEY}/desks/{desk_id}/state", json={"position_mm": new_pos})
    return JSONResponse(resp.json())

# Set exact height
@app.post("/api/desks/{desk_id}/set")
async def set_height(desk_id: str, request: Request):
    data = await request.json()
    target = int(data.get("height", 680))
    resp = requests.put(f"{SIMULATOR_URL}/api/v2/{API_KEY}/desks/{desk_id}/state", json={"position_mm": target})
    return JSONResponse(resp.json())

# Schedule a movement
@app.post("/api/desks/{desk_id}/schedule")
async def schedule_move(desk_id: str, request: Request):
    data = await request.json()
    target = int(data.get("height", 680))
    hour = int(data.get("hour", 12))
    minute = int(data.get("minute", 0))

    def job(height):
        requests.put(f"{SIMULATOR_URL}/api/v2/{API_KEY}/desks/{desk_id}/state", json={"position_mm": height})
    
    job_id = f"{desk_id}_{hour}_{minute}"
    scheduler.add_job(job, 'cron', hour=hour, minute=minute, id=job_id, replace_existing=True, args=[target])
    return {"scheduled": True, "desk_id": desk_id, "height": target, "time": f"{hour:02d}:{minute:02d}"}


@app.post("/api/desks/get_schedule")
async def get_schedule(request: Request):
    data = await request.json()
    desk_id = data.get("desk_id")
    
    jobs = []
    if desk_id == "all":
        jobs = scheduler.get_jobs()
    else:
        # Filter manually if needed or use scheduler's get_jobs with jobstore alias if configured, 
        # but here we can just filter the list since we don't have jobstores set up with aliases matching desk_ids easily without more config.
        # Actually scheduler.get_jobs() returns all jobs. We can filter by ID.
        all_jobs = scheduler.get_jobs()
        jobs = [j for j in all_jobs if j.id.startswith(f"{desk_id}_")]

    schedule_data = []
    for job in jobs:
        # job.id format: "{desk_id}_{hour}_{minute}"
        try:
            parts = job.id.split('_')
            # Handle potential desk_ids with underscores? 
            # The current creation logic is: job_id = f"{desk_id}_{hour}_{minute}"
            # So the last two parts are hour and minute.
            d_id = "_".join(parts[:-2])
            hour = parts[-2]
            minute = parts[-1]
            height = job.args[0]
            
            schedule_data.append({
                "job_id": job.id,
                "desk_id": d_id,
                "hour": int(hour),
                "minute": int(minute),
                "next_run_time": str(job.next_run_time),
                "height": str(height)
            })
        except Exception as e:
            print(f"Error parsing job {job.id}: {e}")
            continue

    return {"schedule": schedule_data}

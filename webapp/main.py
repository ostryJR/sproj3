from fastapi import FastAPI, Request, Form, Response, Depends
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
import requests
import json
import os
from apscheduler.schedulers.background import BackgroundScheduler
from fastapi.middleware.cors import CORSMiddleware
import func
import sqlite3
from passlib.hash import pbkdf2_sha256
from starlette.middleware.sessions import SessionMiddleware

from webapp.init_user_db import init_db
init_db()

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'users.db')

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


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
def set_all_desks_to_1320():
    from datetime import datetime
    now = datetime.now()
    # Only run between 16:00 and 08:00
    if now.hour >= 16 or now.hour < 8:
        try:
            resp = requests.get(f"{SIMULATOR_URL}/api/v2/{API_KEY}/desks")
            desk_ids = resp.json()
            for desk_id in desk_ids:
                requests.put(f"{SIMULATOR_URL}/api/v2/{API_KEY}/desks/{desk_id}/state", json={"position_mm": 1320})
        except Exception as e:
            print(f"Error setting all desks to 1320: {e}")

# Run every 10 minutes (can be changed as needed)
scheduler.add_job(set_all_desks_to_1320, 'interval', minutes=10, id='auto_set_all_1320', replace_existing=True)
scheduler.start()

schedulerForDailySchedule = BackgroundScheduler()
schedulerForDailySchedule.start()

app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, 'static')), name="static")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # allow JS fetch from browser
    allow_methods=["*"],
    allow_headers=["*"]
)
# Add session middleware for login state
app.add_middleware(SessionMiddleware, secret_key="secretkey")


# Dependency to check if user is logged in
def get_current_user(request: Request):
    user = request.session.get("user")
    if not user:
        raise Exception("Not authenticated")
    return user

# Serve HTML frontend (protected)
@app.get("/", response_class=HTMLResponse)
def index(request: Request):
    if not request.session.get("user"):
        return RedirectResponse("/login", status_code=302)
    template_path = os.path.join(BASE_DIR, 'templates', 'index.html')
    with open(template_path, "r") as f:
        return HTMLResponse(f.read())



# Login page
@app.get("/login", response_class=HTMLResponse)
def login_page():
    template_path = os.path.join(BASE_DIR, 'templates', 'login.html')
    with open(template_path, "r") as f:
        return HTMLResponse(f.read())

# Login logic
@app.post("/login")
def login(request: Request, response: Response, username: str = Form(...), password: str = Form(...)):
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM users WHERE username = ?", (username,))
    user = c.fetchone()
    conn.close()
    if user and pbkdf2_sha256.verify(password, user["password_hash"]):
        # Store user info in session
        request.session["user"] = {
            "username": user["username"],
            "desk_id": user["desk_id"],
            "is_admin": user["is_admin"]
        }
        return RedirectResponse("/", status_code=302)
    return HTMLResponse("Invalid credentials. <a href='/login'>Try again</a>.", status_code=400)

# Logout
@app.get("/logout")
def logout(request: Request):
    request.session.clear()
    return RedirectResponse("/login", status_code=302)

# List all desks
@app.get("/api/desks")
def list_desks(request: Request):
    user = request.session.get("user")
    if not user:
        return JSONResponse({"error": "Not authenticated"}, status_code=401)
    # Get list of desk IDs
    resp = requests.get(f"{SIMULATOR_URL}/api/v2/{API_KEY}/desks")
    desk_ids = resp.json()
    desks = []
    # If admin, show all desks; else, only user's desk
    if user["is_admin"]:
        allowed_desks = desk_ids
    else:
        allowed_desks = [user["desk_id"]] if user["desk_id"] in desk_ids else []
    for desk_id in allowed_desks:
        desk_resp = requests.get(f"{SIMULATOR_URL}/api/v2/{API_KEY}/desks/{desk_id}")
        desk_data = desk_resp.json()
        status = desk_data.get("state", {}).get("status", "Normal")
        last_errors = desk_data.get("lastErrors", []) or []

        # include the error code 
        current_error = None
        if status != "Normal" and len(last_errors) > 0:
            latest = last_errors[0]
            current_error = {
                "errorCode": latest.get("errorCode")
            }

        desks.append({
            "id": desk_id,
            "name": desk_data.get("config", {}).get("name", desk_id),
            "position": desk_data.get("state", {}).get("position_mm", 0),
            "status": status,
            "usage": desk_data.get("usage", {}),
            "lastErrors": [ {"errorCode": e.get("errorCode")} for e in last_errors ],
            "currentError": current_error
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
    
    job_id = f"{desk_id.replace(":","")}_{hour}_{minute}"
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
        everydayJobs = schedulerForDailySchedule.get_jobs()
        jobs = [j for j in all_jobs if j.id.startswith(f"{desk_id}_")]
        for j in everydayJobs:
            if j.id.startswith(f"{desk_id}_"):
                jobs.append(j)

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
    
    
    
    with open('scheduleconfig.json', 'r') as file:
        times = json.load(file)
    for time in times:
        hour = int(time['time'].split(':')[0])
        minute = int(time['time'].split(':')[1])
        height = int(time['height'])
        schedule_data.append({
            "job_id": -1,#probably should be changed
            "desk_id": "All",
            "hour": int(hour),
            "minute": int(minute),
            "next_run_time": -1,#probably should be changed
            "height": str(height)
        })
    
    
    
    # print(f'{scheduler.get_jobs()}')
    return {"schedule": schedule_data}


#run scheduler so that the day schedule for desks is loaded at 00:00
func.schedule()
schedulerForDailySchedule.add_job(func.schedule, 'cron', hour=0, minute=0)

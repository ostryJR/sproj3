from fastapi import FastAPI, Request, Form, Response
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
import requests
import json
import os
import sqlite3
from passlib.hash import pbkdf2_sha256
from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy import inspect
import func
from db import engine
from setup_db import initialize_db
# Import the sync function
from sync_desks_continuous import sync_desks_to_db
from apscheduler.schedulers.background import BackgroundScheduler
# -----------------------
# Database setup for SQLite
# -----------------------
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'users.db')

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# Ensure Desk table exists
inspector = inspect(engine)
if "desks" not in inspector.get_table_names():
    print("Desk table not found. Creating tables...")
    initialize_db()
else:
    print("Desk table already exists. Skipping creation.")


# -----------------------
# API / Simulator config
# -----------------------
SIMULATOR_URL = "http://127.0.0.1:8001"
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
API_KEYS_FILE = os.path.join(BASE_DIR, '..', 'config', 'api_keys.json')

def load_api_key():
    with open(API_KEYS_FILE, "r") as f:
        keys = json.load(f)
        return keys[0]

API_KEY = load_api_key()

# -----------------------
# FastAPI app + Middleware
# -----------------------
app = FastAPI(title="Desk Controller Web App")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

app.add_middleware(SessionMiddleware, secret_key="secretkey")
app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, 'static')), name="static")

# -----------------------
# Scheduler setup
# -----------------------
scheduler = BackgroundScheduler()
schedulerForDailySchedule = BackgroundScheduler()

# -----------------------
# FastAPI startup event
# -----------------------
@app.on_event("startup")
def startup_event():
    scheduler.start()
    schedulerForDailySchedule.start()

    # Run daily desk schedule loader at 00:00
    func.schedule()
    schedulerForDailySchedule.add_job(func.schedule, 'cron', hour=0, minute=0)
    print("Schedulers started.")
    # --- Add continuous desk sync ---
    # This will fetch data from the API every 10 seconds and update the database
    scheduler.add_job(sync_desks_to_db, 'interval', seconds=10, id="sync_desks_to_db", replace_existing=True)
    print("Continuous desk sync started.")

# -----------------------
# User / Login dependencies
# -----------------------
def get_current_user(request: Request):
    user = request.session.get("user")
    if not user:
        raise Exception("Not authenticated")
    return user

# -----------------------
# Routes
# -----------------------
@app.get("/", response_class=HTMLResponse)
def index(request: Request):
    if not request.session.get("user"):
        return RedirectResponse("/login", status_code=302)
    template_path = os.path.join(BASE_DIR, 'templates', 'index.html')
    with open(template_path, "r") as f:
        return HTMLResponse(f.read())

@app.get("/login", response_class=HTMLResponse)
def login_page():
    template_path = os.path.join(BASE_DIR, 'templates', 'login.html')
    with open(template_path, "r") as f:
        return HTMLResponse(f.read())

@app.post("/login")
def login(request: Request, response: Response, username: str = Form(...), password: str = Form(...)):
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM users WHERE username = ?", (username,))
    user = c.fetchone()
    conn.close()
    if user and pbkdf2_sha256.verify(password, user["password_hash"]):
        request.session["user"] = {
            "username": user["username"],
            "desk_id": user["desk_id"],
            "is_admin": user["is_admin"]
        }
        return RedirectResponse("/", status_code=302)
    return HTMLResponse("Invalid credentials. <a href='/login'>Try again</a>.", status_code=400)

@app.get("/logout")
def logout(request: Request):
    request.session.clear()
    return RedirectResponse("/login", status_code=302)

# -----------------------
# Desk API endpoints
# -----------------------
@app.get("/api/desks")
def list_desks(request: Request):
    user = request.session.get("user")
    if not user:
        return JSONResponse({"error": "Not authenticated"}, status_code=401)

    resp = requests.get(f"{SIMULATOR_URL}/api/v2/{API_KEY}/desks")
    desk_ids = resp.json()
    desks = []

    allowed_desks = desk_ids if user["is_admin"] else [user["desk_id"]] if user["desk_id"] in desk_ids else []

    for desk_id in allowed_desks:
        desk_resp = requests.get(f"{SIMULATOR_URL}/api/v2/{API_KEY}/desks/{desk_id}")
        desk_data = desk_resp.json()
        desks.append({
            "id": desk_id,
            "name": desk_data.get("config", {}).get("name", desk_id),
            "position": desk_data.get("state", {}).get("position_mm", 0),
            "usage": desk_data.get("usage", {}),
            "lastErrors": desk_data.get("lastErrors", {})
        })
    return JSONResponse(desks)

# Move desk endpoints
@app.post("/api/desks/{desk_id}/up")
async def desk_up(desk_id: str, request: Request):
    data = await request.json()
    step = int(data.get("step", 50))
    desk_resp = requests.get(f"{SIMULATOR_URL}/api/v2/{API_KEY}/desks/{desk_id}")
    desk_data = desk_resp.json()
    new_pos = desk_data.get("state", {}).get("position_mm", 0) + step
    resp = requests.put(f"{SIMULATOR_URL}/api/v2/{API_KEY}/desks/{desk_id}/state", json={"position_mm": new_pos})
    return JSONResponse(resp.json())

@app.post("/api/desks/{desk_id}/down")
async def desk_down(desk_id: str, request: Request):
    data = await request.json()
    step = int(data.get("step", 50))
    desk_resp = requests.get(f"{SIMULATOR_URL}/api/v2/{API_KEY}/desks/{desk_id}")
    desk_data = desk_resp.json()
    new_pos = desk_data.get("state", {}).get("position_mm", 0) - step
    resp = requests.put(f"{SIMULATOR_URL}/api/v2/{API_KEY}/desks/{desk_id}/state", json={"position_mm": new_pos})
    return JSONResponse(resp.json())

@app.post("/api/desks/{desk_id}/set")
async def set_height(desk_id: str, request: Request):
    data = await request.json()
    target = int(data.get("height", 680))
    resp = requests.put(f"{SIMULATOR_URL}/api/v2/{API_KEY}/desks/{desk_id}/state", json={"position_mm": target})
    return JSONResponse(resp.json())

@app.post("/api/desks/{desk_id}/schedule")
async def schedule_move(desk_id: str, request: Request):
    data = await request.json()
    target = int(data.get("height", 680))
    hour = int(data.get("hour", 12))
    minute = int(data.get("minute", 0))

    def job(height):
        requests.put(f"{SIMULATOR_URL}/api/v2/{API_KEY}/desks/{desk_id}/state", json={"position_mm": height})

    job_id = f"{desk_id.replace(':','')}_{hour}_{minute}"
    scheduler.add_job(job, 'cron', hour=hour, minute=minute, id=job_id, replace_existing=True, args=[target])
    return {"scheduled": True, "desk_id": desk_id, "height": target, "time": f"{hour:02d}:{minute:02d}"}

# Get schedule endpoint remains unchanged
@app.post("/api/desks/get_schedule")
async def get_schedule(request: Request):
    # Your existing logic here, unchanged
    # ...
    return {"schedule": []}  # Placeholder; copy your original logic here

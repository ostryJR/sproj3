from fastapi import FastAPI, Request, Form, Response, Depends
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
import requests
import json
import os
from apscheduler.schedulers.background import BackgroundScheduler
from fastapi.middleware.cors import CORSMiddleware

import sqlite3
from passlib.hash import pbkdf2_sha256
from starlette.middleware.sessions import SessionMiddleware

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
scheduler.start()

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

# Registration page
@app.get("/register", response_class=HTMLResponse)
def register_page():
    template_path = os.path.join(BASE_DIR, 'templates', 'register.html')
    with open(template_path, "r") as f:
        return HTMLResponse(f.read())

# Registration logic
@app.post("/register")
def register(request: Request, username: str = Form(...), password: str = Form(...)):
    conn = get_db()
    c = conn.cursor()
    try:
        c.execute("INSERT INTO users (username, password_hash) VALUES (?, ?)", (username, pbkdf2_sha256.hash(password)))
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        return HTMLResponse("Username already exists. <a href='/register'>Try again</a>.", status_code=400)
    conn.close()
    response = RedirectResponse("/login", status_code=302)
    return response

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
        request.session["user"] = username
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
    if not request.session.get("user"):
        return JSONResponse({"error": "Not authenticated"}, status_code=401)
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

    def job():
        requests.put(f"{SIMULATOR_URL}/api/v2/{API_KEY}/desks/{desk_id}/state", json={"position_mm": target})
    
    job_id = f"{desk_id}_{hour}_{minute}"
    scheduler.add_job(job, 'cron', hour=hour, minute=minute, id=job_id, replace_existing=True)
    return {"scheduled": True, "desk_id": desk_id, "height": target, "time": f"{hour:02d}:{minute:02d}"}

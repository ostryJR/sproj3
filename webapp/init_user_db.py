# User database setup for login system
import sqlite3
from passlib.hash import pbkdf2_sha256
from db import DB_PATH
import os

def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            presetStand INTEGER NOT NULL,
            presetSit INTEGER NOT NULL
        )
    ''')

    try:
        c.execute('ALTER TABLE users ADD COLUMN desk_id TEXT')
    except sqlite3.OperationalError:
        pass
    try:
        c.execute('ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0')
    except sqlite3.OperationalError:
        pass
    try:
        c.execute('ALTER TABLE users ADD COLUMN presetStand INTEGER DEFAULT 680')
        c.execute('ALTER TABLE users ADD COLUMN presetSit INTEGER DEFAULT 1100')
    except sqlite3.OperationalError:
        pass
    try:
        c.execute('ALTER TABLE users ADD COLUMN favorite_height INTEGER')
    except sqlite3.OperationalError:
        pass

    # Load desk IDs from desks_state.json
    import json
    DATA_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'desks_state.json')
    with open(DATA_PATH, 'r') as f:
        desks_data = json.load(f)
    desk_ids = [k for k in desks_data.keys() if ':' in k]

    # Create two users per desk
    users = []
    for i, desk_id in enumerate(desk_ids, 1):
        users.append({
            "username": f"user{i}a",
            "password": f"pass{i}a",
            "desk_id": desk_id,
            "is_admin": 0
        })
        users.append({
            "username": f"user{i}b",
            "password": f"pass{i}b",
            "desk_id": desk_id,
            "is_admin": 0
        })
    # Add admin account
    users.append({"username": "admin", "password": "adminpass", "desk_id": None, "is_admin": 1})

    for user in users:
        try:
            c.execute(
                "INSERT INTO users (username, password_hash, desk_id, is_admin, presetStand, presetSit) VALUES (?, ?, ?, ?, 1100, 720)",
                (user["username"], pbkdf2_sha256.hash(user["password"]), user["desk_id"], user["is_admin"])
            )
        except sqlite3.IntegrityError:
            pass  
    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    print("User database initialized.")

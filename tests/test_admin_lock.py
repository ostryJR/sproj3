import os
import sys
import json
import pytest
import importlib
import types

_dummy_main = types.ModuleType("main")
_dummy_main.SIMULATOR_URL = "http://127.0.0.1:8001"
_dummy_main.API_KEY = "DUMMY"
sys.modules["main"] = _dummy_main

for _name in ["models", "crud", "func", "db", "setup_db", "init_user_db", "sync_desks_continuous"]:
    sys.modules[_name] = importlib.import_module(f"webapp.{_name}")

import webapp.main as webapp_main

class FakeResp:
    def __init__(self, payload=None):
        self._payload = payload or {}
    def json(self):
        return self._payload

class FakeRequests:
    def __init__(self):
        self.put_calls = []
    def get(self, url):
        # Return a desk state with a known position for move calculations
        return FakeResp({"state": {"position_mm": 700}})
    def put(self, url, json=None):
        self.put_calls.append({"url": url, "json": json})
        return FakeResp({})


class FakeRequest:
    """Minimal Request stub mirroring what's used in handlers."""
    def __init__(self, user, body=None):
        self.session = {"user": user}
        self._body = body or {}
    async def json(self):
        return self._body


def test_admin_lock_behaviour(monkeypatch):
    """
    This test validates the following functionalities:
    - Admin can lock desk
    - Non-admin blocked with 403 when locked
    - Admin can move while locked
    - Unlock restores non-admin ability
    """

    fake_requests = FakeRequests()
    monkeypatch.setattr(webapp_main, "requests", fake_requests)

    desk_id = "desk:1"
    admin_user = {"username": "admin", "desk_id": None, "is_admin": 1}
    non_admin_user = {"username": "user1a", "desk_id": desk_id, "is_admin": 0}

    # Admin locks the desk
    resp = webapp_main.admin_lock_desk(desk_id, FakeRequest(admin_user))
    assert resp.status_code == 200
    payload = json.loads(resp.body.decode())
    assert payload["locked"] is True

    # Non-admin blocked when desk is locked
    import asyncio
    r = asyncio.run(webapp_main.desk_up(desk_id, FakeRequest(non_admin_user, {"step": 50})))
    assert r.status_code == 403
    blocked = json.loads(r.body.decode())
    assert blocked.get("error") == "Desk is admin-locked"

    # Admin can still move while locked
    r2 = asyncio.run(webapp_main.desk_up(desk_id, FakeRequest(admin_user, {"step": 50})))
    assert r2.status_code == 200

    # Admin unlocks the desk
    resp2 = webapp_main.admin_unlock_desk(desk_id, FakeRequest(admin_user))
    assert resp2.status_code == 200
    payload2 = json.loads(resp2.body.decode())
    assert payload2["locked"] is False

    # Non-admin can move after unlock
    r3 = asyncio.run(webapp_main.desk_up(desk_id, FakeRequest(non_admin_user, {"step": 50})))
    assert r3.status_code == 200

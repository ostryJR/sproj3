import io
import builtins
import webapp.func as func


def test_schedule_adds_jobs(monkeypatch):
    """Verify that schedule() registers the expected cron jobs for each desk and time,
    and that the scheduled job callable performs the expected PUT to the simulator."""

    #fake scheduler that records calls to add_job
    class FakeScheduler:
        def __init__(self):
            self.added_jobs = []

        def add_job(self, func_callable, trigger, hour=None, minute=None, id=None, replace_existing=False, args=None, **kwargs):
            self.added_jobs.append({
                "func": func_callable,
                "trigger": trigger,
                "hour": hour,
                "minute": minute,
                "id": id,
                "replace_existing": replace_existing,
                "args": args,
                **kwargs,
            })

    fake_scheduler = FakeScheduler()

    # Mock requests.get to return a fixed desk list and record the URL called
    called = {}

    def fake_get(url):
        called['url'] = url

        class Resp:
            def json(self):
                return ["desk:1", "desk:2"]

        return Resp()

    # Replace requests.get inside the module
    monkeypatch.setattr(func.requests, "get", fake_get)

    # Capture requests.put calls made by the scheduled job callable
    put_calls = []

    def fake_put(url, *a, **k):
        put_calls.append({"url": url, "json": k.get("json"), "args": a, "kwargs": k})
        class Resp:
            def json(self):
                return {}
        return Resp()

    monkeypatch.setattr(func.requests, "put", fake_put)

    # Mock the schedule config file so the test doesn't actually reads  the real file on disk
    schedule_json = '[{"time":"7:00","height":860},{"time":"16:00","height":680},{"time":"18:00","height":1320},{"time":"08:51","height":1234}]'
    monkeypatch.setattr(builtins, "open", lambda *a, **k: io.StringIO(schedule_json))

    # Run the scheduler registration
    simulator_url = "http://fake-sim"
    api_key = "ABC123"
    func.schedule(fake_scheduler, simulator_url, api_key)

    # Confirm requests.get was called with the expected URL
    assert called['url'] == f"{simulator_url}/api/v2/{api_key}/desks"

    # since the schedule file contains 4 time entries we returned 2 desks above 8 jobs
    assert len(fake_scheduler.added_jobs) == 4 * 2

    # Check that one known job (08:51 -> height 1234) was scheduled properly for desk:1
    expected_id = "desk1_8_51"
    matches = [j for j in fake_scheduler.added_jobs if j['id'] == expected_id]
    assert len(matches) == 1

    job = matches[0]
    assert job['hour'] == 8
    assert job['minute'] == 51
    assert job['replace_existing'] is True
    assert job['args'] == [1234, "desk:1"]

    # Also check one more time with single digit hour (7:00)
    expected_id2 = "desk1_7_0"
    matches2 = [j for j in fake_scheduler.added_jobs if j['id'] == expected_id2]
    assert len(matches2) == 1
    job2 = matches2[0]
    assert job2['hour'] == 7
    assert job2['minute'] == 0
    assert job2['args'][1] == "desk:1"

    # Execute the scheduled job for 08:51 and verify it makes the expected PUT
    job['func'](*job['args'])
    assert any(
        call['url'] == f"{simulator_url}/api/v2/{api_key}/desks/desk:1/state" and
        call['json'] == {"position_mm": 1234}
        for call in put_calls
    )
    
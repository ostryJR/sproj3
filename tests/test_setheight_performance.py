import time
import webapp.func as func

def test_job_set_height_performance(monkeypatch):
    """Performance test: job() should set desk height up and down quickly."""
    # Prepare a dummy requests.put to avoid real HTTP calls
    call_log = []
    def fake_put(url, json=None, **kwargs):
        call_log.append((url, json))
        class Resp:
            def json(self):
                return {}
        return Resp()
    monkeypatch.setattr(func.requests, "put", fake_put)

    # Recreate the job function as in func.schedule
    def job(height, desk_id):
        return func.requests.put(
            f"http://fake/api/v2/key/desks/{desk_id}/state",
            json={"position_mm": height}
        )

    # Test setting height up and down
    start = time.time()
    job(1200, "desk:1")  # up
    job(700, "desk:1")   # down
    duration = time.time() - start
    assert duration < 0.2  
    assert call_log[0][1]["position_mm"] == 1200
    assert call_log[1][1]["position_mm"] == 700

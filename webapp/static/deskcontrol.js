async function move(id, dir) {
    const step = 50;
    await fetch(`/api/desks/${id}/${dir}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ step }) });
    await fetchDesks();
}

async function setHeight(id) {
    let val;
    if (arguments.length > 1 && arguments[1] !== undefined) {
        val = arguments[1];
    } else {
        val = document.getElementById(`height_${id}`).value;
    }
    if (!val || isNaN(val)) {
        alert("Please enter a valid height.");
        return;
    }
    console.log(`Setting desk ${id} to height: ${val}`);
    try {
        for (let i = 0; i < 5; i++) {
            const resp = await fetch(`/api/desks/${id}/set`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ height: val }) });
            if (!resp.ok) {
                const text = await resp.text();
                alert(`Error setting height: ${resp.status} ${text}`);
                break;
            }
            await new Promise(res => setTimeout(res, 1000));
        }
        await fetchDesks();
    } catch (e) {
        alert("Failed to set height: " + e);
    }
}

function toggleLock(id) {
    const btn = document.getElementById(`lock_${id}`);
    if (window.lockIntervals[id]) {
        clearInterval(window.lockIntervals[id]);
        delete window.lockIntervals[id];
        btn.textContent = "Lock Height";
        console.log(`Lock released for desk ${id}`);
    } else {
        const val = document.getElementById(`height_${id}`).value;
        if (!val) {
            alert("Enter a height to lock.");
            return;
        }
        window.lockIntervals[id] = setInterval(async () => {
            try {
                const resp = await fetch(`/api/desks/${id}/set`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ height: val }) });
                if (!resp.ok) {
                    const text = await resp.text();
                    console.error(`Lock Height error for desk ${id}: ${resp.status} ${text}`);
                } else {
                    console.log(`Lock Height sent for desk ${id} to ${val}`);
                }
            } catch (e) {
                console.error(`Lock Height failed for desk ${id}:`, e);
            }
        }, 1000);
        btn.textContent = "Unlock";
        console.log(`Lock engaged for desk ${id} at height ${val}`);
    }
}
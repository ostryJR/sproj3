
// Lock Height Feature
window.lockIntervals = window.lockIntervals || {};

async function fetchDesks() {
    const res = await fetch("/api/desks");
    const desks = await res.json();
    const container = document.getElementById("desks");

    let table = container.querySelector("table");
    if (!table) {
        container.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Desk Name (ID)</th>
                    <th>Position</th>
                    <th>Controls</th>
                    <th>Set Height</th>
                    <th>Lock</th>
                    <th>Schedule</th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>`;
        table = container.querySelector("table");
    }

    const tbody = table.querySelector("tbody");

    // Keep track of current desk IDs to remove stale rows if necessary (optional, but good practice)
    const currentDeskIds = new Set(desks.map(d => d.id));

    desks.forEach(d => {
        let row = document.getElementById(`desk_row_${d.id}`);
        if (!row) {
            row = document.createElement("tr");
            row.id = `desk_row_${d.id}`;
            row.innerHTML = `
                <td><b>${d.name}</b> (ID: ${d.id})</td>
                <td><span id="pos_${d.id}">${d.position}</span> mm</td>
                <td>
                    <button class="btn-up" onclick="move('${d.id}', 'up')">Up</button>
                    <button class="btn-down" onclick="move('${d.id}', 'down')">Down</button>
                </td>
                <td>
                    <input type="number" id="height_${d.id}" placeholder="mm">
                    <button class="btn-step" onclick="setHeight('${d.id}')">Set</button>
                </td>
                <td>
                    <button id="lock_${d.id}" class="btn-stop" onclick="toggleLock('${d.id}')">Lock Height</button>
                </td>
                <td>
                    <input type="number" id="hour_${d.id}" placeholder="H">
                    <input type="number" id="minute_${d.id}" placeholder="M">
                    <input type="number" id="sched_height_${d.id}" placeholder="mm">
                    <button class="btn-step" onclick="schedule('${d.id}')">Schedule</button>
                </td>
            `;
            tbody.appendChild(row);
        } else {
            // Update dynamic values
            const posSpan = document.getElementById(`pos_${d.id}`);
            if (posSpan) posSpan.textContent = d.position;
        }

        // Update lock button state based on client-side state
        const lockBtn = document.getElementById(`lock_${d.id}`);
        if (lockBtn) {
            if (window.lockIntervals && window.lockIntervals[d.id]) {
                lockBtn.textContent = "Unlock";
            } else {
                lockBtn.textContent = "Lock Height";
            }
        }
    });

    // Remove rows for desks that no longer exist
    const rows = tbody.querySelectorAll("tr");
    rows.forEach(row => {
        const id = row.id.replace("desk_row_", "");
        if (!currentDeskIds.has(id)) {
            row.remove();
        }
    });
}

async function move(id, dir) {
    const step = 50;
    await fetch(`/api/desks/${id}/${dir}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ step }) });
    await fetchDesks();
}

async function setHeight(id) {
    const val = document.getElementById(`height_${id}`).value;
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

async function schedule(id) {
    const h = document.getElementById(`hour_${id}`).value;
    const m = document.getElementById(`minute_${id}`).value;
    const val = document.getElementById(`sched_height_${id}`).value;
    await fetch(`/api/desks/${id}/schedule`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hour: h, minute: m, height: val }) });
    alert("Scheduled!");
}

fetchDesks();
setInterval(fetchDesks, 5000); // update positions every 5s

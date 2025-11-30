
// Suppress all alert dialogs on this site
window.alert = function () { /* no-op */ };

// Lock Height Feature
window.lockIntervals = window.lockIntervals || {};

function updateClock() {
    const now = new Date();
    const pad = n => n.toString().padStart(2, '0');
    const str = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    document.getElementById('clock').textContent = 'Current time: ' + str;
}

async function getDeskData() {
    const resp = await fetch(`/api/desks`);
    const data = await resp.json();
    // console.log(data);
    return data;
}

async function fetchDesks(desks) {
    // const desks = await getDeskData();
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
    getSchedule("all");
}

async function updatePage() {
    const desks = await getDeskData();
    fetchDesks(desks);
    updateSchedule(desks);
    updateCharts(desks);
}

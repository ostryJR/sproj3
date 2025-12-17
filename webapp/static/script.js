
// Lock Height Feature
window.lockIntervals = window.lockIntervals || {};

// Popup Functions
function openDeskPopup(deskId) {
    const popup = document.getElementById('deskPopup');
    const popupContent = document.getElementById('popupDeskContent');

    const desk = desks.find(d => d.id == deskId);
    console.log(desk);
    var deskName = desk["name"];
    // Set popup content
    popupContent.innerHTML = `
        <h2 class="popup-header">Desk Details: ${deskName} (ID: ${deskId})</h2>
        <div style="margin-top: 30px;">
            <!--<p style="font-size: 1.2em; margin-bottom: 15px;">Desk ID: <strong>${deskId}</strong></p>
            <p style="font-size: 1.2em; margin-bottom: 15px;">Desk Name: <strong>${deskName}</strong></p>
            <p style="color: #666;">Add more desk details here...</p>-->
            <p style="font-size: 1.2em; margin-bottom: 15px;">Sit Stand Counter: <strong>${desk["usage"]["sitStandCounter"]}</strong></p>
            <p style="font-size: 1.2em; margin-bottom: 15px;">Activations Counter: <strong>${desk["usage"]["activationsCounter"]}</strong></p>
            <canvas id="myChart3"
                style="box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08), 0 1.5px 4px rgba(0, 0, 0, 0.06);border-radius: 12px;"></canvas>
        </div>
    `;
    updateCharts();
    popup.classList.add('active');
}

function closeDeskPopup() {
    const popup = document.getElementById('deskPopup');
    popup.classList.remove('active');
}

function updateClock() {
    const now = new Date();
    const pad = n => n.toString().padStart(2, '0');
    const str = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    document.getElementById('clock').textContent = str;
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
            row.setAttribute("onclick", "openDeskPopup('"+(d.id)+"');");
            row.setAttribute("style","cursor: pointer;");
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
    desks = await getDeskData();
    fetchDesks(desks);
    updateSchedule(desks);
    updateCharts(desks);
}

var desks = [];
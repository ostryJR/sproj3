
// Lock Height Feature
window.lockIntervals = window.lockIntervals || {};

async function fetchDesks() {
    const res = await fetch("/api/desks");
    const desks = await res.json();
    const container = document.getElementById("desks");
    
    // Preserve current input values
    const heightInputs = {};
    const hourInputs = {};
    const minuteInputs = {};
    const schedHeightInputs = {};
    desks.forEach(d => {
        const inp = document.getElementById(`height_${d.id}`);
        if (inp) heightInputs[d.id] = inp.value;
        const hourInp = document.getElementById(`hour_${d.id}`);
        if (hourInp) hourInputs[d.id] = hourInp.value;
        const minuteInp = document.getElementById(`minute_${d.id}`);
        if (minuteInp) minuteInputs[d.id] = minuteInp.value;
        const schedHeightInp = document.getElementById(`sched_height_${d.id}`);
        if (schedHeightInp) schedHeightInputs[d.id] = schedHeightInp.value;
    });

    // Build table structure
    let tableHtml = `
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
            <tbody>
    `;

    desks.forEach(d => {
        tableHtml += `
            <tr>
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
            </tr>
        `;
    });

    tableHtml += `
            </tbody>
        </table>
    `;

    container.innerHTML = tableHtml;

    // Restore previous input values if present
    desks.forEach(d => {
        if (heightInputs[d.id]) {
            const el = document.getElementById(`height_${d.id}`);
            if(el) el.value = heightInputs[d.id];
        }
        if (hourInputs[d.id]) {
            const el = document.getElementById(`hour_${d.id}`);
            if(el) el.value = hourInputs[d.id];
        }
        if (minuteInputs[d.id]) {
            const el = document.getElementById(`minute_${d.id}`);
            if(el) el.value = minuteInputs[d.id];
        }
        if (schedHeightInputs[d.id]) {
            const el = document.getElementById(`sched_height_${d.id}`);
            if(el) el.value = schedHeightInputs[d.id];
        }
        // Set lock button state if already locked
        if (window.lockIntervals && window.lockIntervals[d.id]) {
            const btn = document.getElementById(`lock_${d.id}`);
            if(btn) btn.textContent = "Unlock";
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

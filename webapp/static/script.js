
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
    container.innerHTML = "";
    desks.forEach(d => {
        const div = document.createElement("div");
        div.innerHTML = `
            <b>${d.name}</b> (ID: ${d.id})<br>
            Position: <span id="pos_${d.id}">${d.position}</span> mm<br>
            <button onclick="move('${d.id}', 'up')">Up</button>
            <button onclick="move('${d.id}', 'down')">Down</button>
            <input type="number" id="height_${d.id}" placeholder="mm">
            <button onclick="setHeight('${d.id}')">Set Height</button>
            <button id="lock_${d.id}" onclick="toggleLock('${d.id}')">Lock Height</button><br>
            <input type="number" id="hour_${d.id}" placeholder="hour (0-23)">
            <input type="number" id="minute_${d.id}" placeholder="minute (0-59)">
            <input type="number" id="sched_height_${d.id}" placeholder="mm">
            <button onclick="schedule('${d.id}')">Schedule</button>
            <hr>
        `;
        container.appendChild(div);
        // Restore previous input values if present
        if (heightInputs[d.id]) {
            document.getElementById(`height_${d.id}`).value = heightInputs[d.id];
        }
        if (hourInputs[d.id]) {
            document.getElementById(`hour_${d.id}`).value = hourInputs[d.id];
        }
        if (minuteInputs[d.id]) {
            document.getElementById(`minute_${d.id}`).value = minuteInputs[d.id];
        }
        if (schedHeightInputs[d.id]) {
            document.getElementById(`sched_height_${d.id}`).value = schedHeightInputs[d.id];
        }
        // Set lock button state if already locked
        if (window.lockIntervals && window.lockIntervals[d.id]) {
            document.getElementById(`lock_${d.id}`).textContent = "Unlock";
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

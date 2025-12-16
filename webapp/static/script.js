

// Lock Height Feature
window.lockIntervals = window.lockIntervals || {};
window.lockAllInterval = null;

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
    // to avoid system error fetchDesks expects a desks array but setHeight() calls it with no args
    if (!desks) {
        desks = await getDeskData();
    }
    const container = document.getElementById("desks");
    const currentDeskIds = new Set(desks.map(d => d.id));

    desks.forEach(d => {
        let card = document.getElementById(`desk_card_${d.id}`);
        if (!card) {
            const template = document.getElementById('desk-card-template');
            card = template.content.firstElementChild.cloneNode(true);
            card.id = `desk_card_${d.id}`;
            card.querySelector('.desk-name').textContent = d.name;
            card.querySelector('.desk-id').textContent = `ID: ${d.id}`;
            card.querySelector('.pos').textContent = d.position;

            // Button handlers
            card.querySelector('.btn-up').onclick = () => move(d.id, 'up');
            card.querySelector('.btn-down').onclick = () => move(d.id, 'down');
            card.querySelector('.btn-step').onclick = () => setHeight(d.id);
            card.querySelector('.lock-btn').onclick = () => toggleLock(d.id);
            card.querySelector('.schedule-btn').onclick = () => schedule(d.id);

            // Inputs
            card.querySelector('.height-input').id = `height_${d.id}`;
            card.querySelector('.hour-input').id = `hour_${d.id}`;
            card.querySelector('.minute-input').id = `minute_${d.id}`;
            card.querySelector('.sched-height-input').id = `sched_height_${d.id}`;
            card.querySelector('.lock-btn').id = `lock_${d.id}`;

            container.appendChild(card);
        } else {
            // Update dynamic values
            const posSpan = card.querySelector('.pos');
            if (posSpan) posSpan.textContent = d.position;
        }

        // Update lock button state
        const lockBtn = card.querySelector('.lock-btn');
        if (lockBtn) {
            if ((window.lockIntervals && window.lockIntervals[d.id]) || window.lockAllInterval) {
                lockBtn.textContent = "Unlock";
            } else {
                lockBtn.textContent = "Lock Height";
            }
        }
    });

    // Remove cards for desks that no longer exist
    const cards = container.querySelectorAll(".desk-card");
    cards.forEach(card => {
        const id = card.id.replace("desk_card_", "");
        if (!currentDeskIds.has(id)) {
            card.remove();
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

// Control all desks at once
async function setHeightAll() {
    const val = document.getElementById('height_all').value;
    if (!val || isNaN(val)) {
        alert("Please enter a valid height.");
        return;
    }
    const desks = await getDeskData();
    for (const desk of desks) {
        await setHeight(desk.id);
    }
    document.getElementById('height_all').value = val;
}

function toggleLockAll() {
    const btn = document.getElementById('lock_all');
    const val = document.getElementById('height_all').value;
    
    if (window.lockAllInterval) {
        clearInterval(window.lockAllInterval);
        window.lockAllInterval = null;
        btn.textContent = "Lock All";
        console.log('Lock released for all desks');
    } else {
        if (!val) {
            alert("Enter a height to lock.");
            return;
        }
        window.lockAllInterval = setInterval(async () => {
            const desks = await getDeskData();
            for (const desk of desks) {
                try {
                    await fetch(`/api/desks/${desk.id}/set`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ height: val })
                    });
                } catch (e) {
                    console.error(`Lock Height failed for desk ${desk.id}:`, e);
                }
            }
        }, 1000);
        btn.textContent = "Unlock All";
        console.log(`Lock engaged for all desks at height ${val}`);
    }
}

// Premade schedule: Between 16:00 and 08:00, set all desks to 1320mm (once per day)
let desksSetTo1320 = false;
setInterval(async () => {
    const now = new Date();
    const hour = now.getHours();
    if ((hour >= 16 || hour < 8) && !desksSetTo1320) {
        const desks = await getDeskData();
        for (const desk of desks) {
            await fetch(`/api/desks/${desk.id}/set`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ height: 1320 })
            });
        }
        desksSetTo1320 = true;
    } else if (hour >= 8 && hour < 16) {
        desksSetTo1320 = false;
    }
}, 60000);

// -------------------------
// Desk Lock and Control JS
// -------------------------

window.lockIntervals = {}; // Track per-desk locks
window.lockAllInterval = null;
var desks = [];

// -------------------------
// Clock Update
// -------------------------
function updateClock() {
    const now = new Date();
    const pad = n => n.toString().padStart(2, '0');
    const str = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    document.getElementById('clock').textContent = str;
}

// -------------------------
// Popup Helper
// -------------------------
function showPopup(message) {
    const popupContainer = document.getElementById("system-popups");
    const popup = document.createElement("div");
    popup.className = "popup-message";
    popup.textContent = message;
    popupContainer.appendChild(popup);
    setTimeout(() => popup.remove(), 3000); // auto remove after 3s
}

// -------------------------
// Lock/Unlock Desk
// -------------------------
function toggleLock(id) {
    const card = document.getElementById(`desk_card_${id}`);
    const btn = card.querySelector(".lock-btn");
    const heightInput = card.querySelector(".height-input");
    const val = heightInput.value;

    if (!card || !btn) return;

    if (card.classList.contains("locked")) {
        // Unlock
        card.classList.remove("locked");
        card.querySelectorAll("button, input").forEach(el => el.disabled = false);
        btn.disabled = false;
        delete window.lockIntervals[id];
        btn.textContent = "Lock Height";
        showPopup(`Desk ${id} unlocked`);
    } else {
        if (!val) {
            alert("Enter a height to lock.");
            return;
        }
        // Lock desk
        card.classList.add("locked");
        card.querySelectorAll("button, input").forEach(el => {
            if (!el.classList.contains("lock-btn")) el.disabled = true;
        });
        btn.disabled = false;
        btn.textContent = "Unlock";

        // Periodic enforcement
        window.lockIntervals[id] = setInterval(async () => {
            try {
                await fetch(`/api/desks/${id}/set`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ height: val })
                });
            } catch (e) {
                console.error(`Lock Height failed for desk ${id}:`, e);
            }
        }, 1000);
        showPopup(`Desk ${id} locked at ${val}mm`);
    }
}

// -------------------------
// Lock/Unlock All Desks
// -------------------------
function toggleLockAll() {
    const btn = document.getElementById('lock_all');
    const val = document.getElementById('height_all').value;

    if (window.lockAllInterval) {
        clearInterval(window.lockAllInterval);
        window.lockAllInterval = null;
        btn.textContent = "Lock All";
        desks.forEach(d => unlockDeskUI(d.id));
        showPopup("All desks unlocked");
    } else {
        if (!val) {
            alert("Enter a height to lock.");
            return;
        }
        btn.textContent = "Unlock All";
        desks.forEach(d => lockDeskUI(d.id, val));

        window.lockAllInterval = setInterval(async () => {
            for (const d of desks) {
                try {
                    await fetch(`/api/desks/${d.id}/set`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ height: val })
                    });
                } catch (e) {
                    console.error(`Lock All failed for desk ${d.id}:`, e);
                }
            }
        }, 1000);
        showPopup(`All desks locked at ${val}mm`);
    }
}

// -------------------------
// Helper to lock a desk UI
// -------------------------
function lockDeskUI(id, val) {
    const card = document.getElementById(`desk_card_${id}`);
    if (!card) return;
    card.classList.add("locked");
    card.querySelectorAll("button, input").forEach(el => {
        if (!el.classList.contains("lock-btn")) el.disabled = true;
    });
    card.querySelector(".lock-btn").disabled = false;
    card.querySelector(".lock-btn").textContent = "Unlock";
    // Ensure height enforcement
    if (window.lockIntervals[id]) clearInterval(window.lockIntervals[id]);
    window.lockIntervals[id] = setInterval(async () => {
        try {
            await fetch(`/api/desks/${id}/set`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ height: val })
            });
        } catch (e) {
            console.error(`Lock Height failed for desk ${id}:`, e);
        }
    }, 1000);
}

// -------------------------
// Helper to unlock a desk UI
// -------------------------
function unlockDeskUI(id) {
    const card = document.getElementById(`desk_card_${id}`);
    if (!card) return;
    card.classList.remove("locked");
    card.querySelectorAll("button, input").forEach(el => el.disabled = false);
    card.querySelector(".lock-btn").disabled = false;
    card.querySelector(".lock-btn").textContent = "Lock Height";
    if (window.lockIntervals[id]) clearInterval(window.lockIntervals[id]);
    delete window.lockIntervals[id];
}

// -------------------------
// Fetch & Render Desks
// -------------------------
async function getDeskData() {
    const resp = await fetch(`/api/desks`);
    return await resp.json();
}

async function fetchDesks(desksData) {
    if (!desksData) desksData = await getDeskData();
    desks = desksData;

    const container = document.getElementById("desks");
    const currentDeskIds = new Set(desksData.map(d => d.id));

    desksData.forEach(d => {
        let card = document.getElementById(`desk_card_${d.id}`);
        if (!card) {
            const template = document.getElementById('desk-card-template');
            card = template.content.firstElementChild.cloneNode(true);
            card.id = `desk_card_${d.id}`;
            card.querySelector('.desk-name').textContent = d.name;
            card.querySelector('.desk-id').textContent = `ID: ${d.id}`;
            card.querySelector('.pos').textContent = d.position;

            // Assign IDs to inputs/buttons
            card.querySelector('.height-input').id = `height_${d.id}`;
            card.querySelector('.hour-input').id = `hour_${d.id}`;
            card.querySelector('.minute-input').id = `minute_${d.id}`;
            card.querySelector('.sched-height-input').id = `sched_height_${d.id}`;
            card.querySelector('.lock-btn').id = `lock_${d.id}`;

            // Button handlers
            card.querySelector('.btn-up').onclick = () => move(d.id, 'up');
            card.querySelector('.btn-down').onclick = () => move(d.id, 'down');
            card.querySelector('.btn-step').onclick = () => setHeight(d.id);
            card.querySelector('.schedule-btn').onclick = () => schedule(d.id);
            card.querySelector('.lock-btn').onclick = () => toggleLock(d.id);

            container.appendChild(card);
        } else {
            card.querySelector('.pos').textContent = d.position;
        }
    });

    // Remove old cards
    const cards = container.querySelectorAll(".desk-card");
    cards.forEach(card => {
        const id = card.id.replace("desk_card_", "");
        if (!currentDeskIds.has(id)) card.remove();
    });
}

// -------------------------
// Page Updates
// -------------------------
async function updatePage() {
    desks = await getDeskData();
    await fetchDesks(desks);
    updateSchedule(desks);
    updateCharts(desks);
}

// -------------------------
// Control All Desks
// -------------------------
async function setHeightAll() {
    const val = document.getElementById('height_all').value;
    if (!val || isNaN(val)) {
        alert("Please enter a valid height.");
        return;
    }
    for (const desk of desks) {
        await setHeight(desk.id, val);
    }
    document.getElementById('height_all').value = val;
}

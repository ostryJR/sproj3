// -------------------------
// Desk Lock and Control JS
// -------------------------


window.actionLocks = window.actionLocks || {};
window.adminLocks = window.adminLocks || {};
function lockDesk(id) { window.actionLocks[id] = true; }
function unlockDesk(id) { delete window.actionLocks[id]; }

async function lockedAction(id, action) {
    // Block if admin-locked and current user is not admin
    const d = Array.isArray(desks) ? desks.find(x => String(x.id) === String(id)) : null;
    const isAdminUser = d && !!d.is_admin;
    if (window.adminLocks && window.adminLocks[id] && !isAdminUser) {
        showPopup(`Desk ${id} is admin-locked`);
        return;
    }
    if (window.actionLocks && window.actionLocks[id]) return; // prevent concurrent actions
    lockDesk(id);
    try {
        await action();
        // simple: refresh UI
        await fetchDesks();
    } finally {
        unlockDesk(id);
    }
}
// Simple UI lock-all flag (no intervals)
window.lockAll = false;
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
async function toggleLock(id) {
    // Admin lock: prevents non-admin users from performing actions on this desk
    const card = document.getElementById(`desk_card_${id}`);
    const btn = card?.querySelector(".lock-btn");
    if (!card || !btn) return;

    const d = Array.isArray(desks) ? desks.find(x => String(x.id) === String(id)) : null;
    const isAdminUser = d && !!d.is_admin;
    try {
        if (window.adminLocks[id]) {
            const r = await fetch(`/api/desks/${id}/admin_unlock`, { method: 'POST' });
            if (!r.ok) throw new Error('unlock failed');
            delete window.adminLocks[id];
            card.classList.remove("locked");
            card.querySelectorAll("button, input").forEach(el => el.disabled = false);
            btn.disabled = false;
            btn.textContent = "Lock Desk";
            showPopup(`Desk ${id} unlocked`);
        } else {
            const r = await fetch(`/api/desks/${id}/admin_lock`, { method: 'POST' });
            if (!r.ok) throw new Error('lock failed');
            window.adminLocks[id] = true;
            card.classList.add("locked");
            card.querySelectorAll("button, input").forEach(el => {
                if (el.classList.contains("lock-btn")) return;
                el.disabled = !isAdminUser;
            });
            btn.disabled = false;
            btn.textContent = "Unlock Desk";
            showPopup(`Desk ${id} locked by admin`);
        }
    } catch (e) {
        console.error('Admin lock toggle failed', e);
        showPopup('Action failed');
    }
}

// -------------------------
// Lock/Unlock All Desks
// -------------------------
function toggleLockAll() {
    const btn = document.getElementById('lock_all');
    const val = document.getElementById('height_all').value;
    if (!window.lockAll) {
        if (!val) { alert("Enter a height to lock."); return; }
        window.lockAll = true;
        btn.textContent = "Unlock All";
        desks.forEach(d => lockDeskUI(d.id));
        showPopup("All desks locked (UI only)");
    } else {
        window.lockAll = false;
        btn.textContent = "Lock All";
        desks.forEach(d => unlockDeskUI(d.id));
        showPopup("All desks unlocked");
    }
}

// -------------------------
// Helper to lock a desk UI
// -------------------------
function lockDeskUI(id) {
    const card = document.getElementById(`desk_card_${id}`);
    if (!card) return;
    card.classList.add("locked");
    card.querySelectorAll("button, input").forEach(el => {
        if (!el.classList.contains("lock-btn")) el.disabled = true;
    });
    card.querySelector(".lock-btn").disabled = false;
    card.querySelector(".lock-btn").textContent = "Unlock Desk";
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
    card.querySelector(".lock-btn").textContent = "Lock Desk";
}

// -------------------------
// Fetch & Render Desks
// -------------------------
async function getDeskData() {
    const resp = await fetch(`/api/desks`);
    return await resp.json();
    
}

async function getUserData() {
    const resp = await fetch(`/api/userdata`, {method: "POST", headers: { "Content-Type": "application/json" }});
    const data = await resp.json();
    document.getElementById("presetHeightSit").value = data["presetSit"];
    document.getElementById("presetHeightStand").value = data["presetStand"];
}
async function getUserData() {
    const resp = await fetch(`/api/userdata`, {method: "POST", headers: { "Content-Type": "application/json" }});
    const data = await resp.json();
    document.getElementById("presetHeightSit").value = data["presetSit"];
    document.getElementById("presetHeightStand").value = data["presetStand"];
}
async function setUserData() {
    await fetch(`/api/userdataupdate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ presetSit: document.getElementById("presetHeightSit").value, presetStand: document.getElementById("presetHeightStand").value})
    });
    getUserData();
}
async function fetchDesks(desksData) {
    if (!desksData) desksData = await getDeskData();
    desks = desksData;

    const container = document.getElementById("desks");
    const currentDeskIds = new Set(desksData.map(d => d.id));

    // Hide or show global controls based on admin status
    const isAdmin = desksData && desksData.length ? desksData.some(x => !!x.is_admin) : false;
    const allControls = document.querySelector('.all-desks-control');
    if (allControls) {
        allControls.style.display = isAdmin ? '' : 'none';
    }
    // If a non-admin somehow has lockAll running, stop it when hiding controls
    if (!isAdmin && window.lockAll) {
        window.lockAll = false;
        const lockBtn = document.getElementById('lock_all');
        if (lockBtn) lockBtn.textContent = 'Lock All';
    }

    desksData.forEach(d => {
        let card = document.getElementById(`desk_card_${d.id}`);
        if (!card) {
            const template = document.getElementById('desk-card-template');
            card = template.content.firstElementChild.cloneNode(true);
            card.id = `desk_card_${d.id}`;
            card.querySelector('.desk-name').textContent = d.name;
            card.querySelector('.desk-id').textContent = `ID: ${d.id}`;
            card.querySelector('.pos').textContent = d.position;

            // Error/status display (initial)
            const errorDivInit = card.querySelector('.desk-error');
            if (errorDivInit) {
                const hasStatus = d.status && d.status !== 'Normal';
                if (hasStatus && d.currentError) {
                    const ce = d.currentError;
                    let text = d.status;
                    if (ce && ce.errorCode) text += ` - Error ${ce.errorCode}`;
                    errorDivInit.style.display = 'block';
                    errorDivInit.classList.remove('no-error');
                    errorDivInit.textContent = text;
                } else {
                    // Show No current error by default
                    errorDivInit.style.display = 'block';
                    errorDivInit.classList.add('no-error');
                    errorDivInit.textContent = 'No current error';
                }
            }

            // Button handlers
            card.querySelector('.btn-up').onclick = () => lockedAction(d.id, () => move(d.id, 'up'));
            card.querySelector('.btn-down').onclick = () => lockedAction(d.id, () => setHeight(d.id, 'down'));
            card.querySelector('.btn-sit').onclick = () => lockedAction(d.id, () => goToPreset(d.id, "sit"));
            card.querySelector('.btn-stand').onclick = () => lockedAction(d.id, () => goToPreset(d.id, "stand"));
            card.querySelector('.btn-step').onclick = () => lockedAction(d.id, () => setHeight(d.id));
            card.querySelector('.schedule-btn').onclick = () => lockedAction(d.id, () => schedule(d.id));
            // Lock button is visible but non-functional for now
            card.querySelector('.lock-btn').onclick = null;
            card.querySelector('.schedule-btn').onclick = () => schedule(d.id);

            // Inputs
            // Assign IDs to inputs/buttons
            card.querySelector('.height-input').id = `height_${d.id}`;
            card.querySelector('.hour-input').id = `hour_${d.id}`;
            card.querySelector('.minute-input').id = `minute_${d.id}`;
            card.querySelector('.sched-height-input').id = `sched_height_${d.id}`;
            card.querySelector('.lock-btn').id = `lock_${d.id}`;

            // Button handlers
            card.querySelector('.btn-up').onclick = () => lockedAction(d.id, () => move(d.id, 'up'));
            card.querySelector('.btn-down').onclick = () => lockedAction(d.id, () => move(d.id, 'down'));
            card.querySelector('.btn-step').onclick = () => lockedAction(d.id, () => setHeight(d.id));
            card.querySelector('.schedule-btn').onclick = () => lockedAction(d.id, () => schedule(d.id));
            card.querySelector('.lock-btn').onclick = () => toggleLock(d.id);

            // Hide Lock and Schedule controls for non-admin users
            if (!d.is_admin) {
                const lockGroup = card.querySelector('.lock-btn')?.closest('.control-group');
                if (lockGroup) lockGroup.style.display = 'none';
                const schedGroup = card.querySelector('.schedule-btn')?.closest('.control-group');
                if (schedGroup) schedGroup.style.display = 'none';
            }

            // Apply admin-locked state from server
            if (d.admin_locked) {
                window.adminLocks[d.id] = true;
                card.classList.add('locked');
                card.querySelectorAll('button, input').forEach(el => {
                    if (el.classList.contains('lock-btn')) return;
                    el.disabled = !d.is_admin;
                });
            } else {
                delete window.adminLocks[d.id];
            }

            container.appendChild(card);
        } else {
            // Update dynamic values
            const posSpan = card.querySelector('.pos');
            if (posSpan) posSpan.textContent = d.position;

            // Update error/status display
            const errorDiv = card.querySelector('.desk-error');
            const hasStatus = d.status && d.status !== 'Normal';
            if (errorDiv) {
                // current errors (status != Normal) Otherwise 'No current error'
                if (hasStatus && d.currentError) {
                    const ce = d.currentError;
                    let text = d.status;
                    if (ce && ce.errorCode) text += ` - Error ${ce.errorCode}`;
                    errorDiv.style.display = 'block';
                    errorDiv.classList.remove('no-error');
                    errorDiv.textContent = text;
                } else {
                    // No active hindering error
                    errorDiv.style.display = 'block';
                    errorDiv.classList.add('no-error');
                    errorDiv.textContent = 'No current error';
                }
            }

            // Hide Lock and Schedule controls for non-admin users (update)
            if (!d.is_admin) {
                const lockGroup = card.querySelector('.lock-btn')?.closest('.control-group');
                if (lockGroup) lockGroup.style.display = 'none';
                const schedGroup = card.querySelector('.schedule-btn')?.closest('.control-group');
                if (schedGroup) schedGroup.style.display = 'none';
            } else {
                const lockGroup = card.querySelector('.lock-btn')?.closest('.control-group');
                if (lockGroup) lockGroup.style.display = '';
                const schedGroup = card.querySelector('.schedule-btn')?.closest('.control-group');
                if (schedGroup) schedGroup.style.display = '';
            }

            // Apply/clear admin-locked state from server
            if (d.admin_locked) {
                window.adminLocks[d.id] = true;
                card.classList.add('locked');
                card.querySelectorAll('button, input').forEach(el => {
                    if (el.classList.contains('lock-btn')) return;
                    el.disabled = !d.is_admin;
                });
            } else {
                delete window.adminLocks[d.id];
                // Re-enable controls if previously locked (except non-admin hidden groups)
                card.classList.remove('locked');
                card.querySelectorAll('button, input').forEach(el => el.disabled = false);
            }
        }

        // Update lock button state
        const lockBtn = card.querySelector('.lock-btn');
        if (lockBtn) {
            lockBtn.textContent = (window.adminLocks && window.adminLocks[d.id]) || window.lockAll ? "Unlock Desk" : "Lock Desk";
        }
    });

    // Remove old cards
    const cards = container.querySelectorAll(".desk-card");
    cards.forEach(card => {
        const id = card.id.replace("desk_card_", "");
        if (!currentDeskIds.has(id)) card.remove();
    });
    // Process popups for any new or resolved errors
    try { processPopups(desksData); } catch (e) { console.error('Popup processing failed', e); }
    getSchedule("all");
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
    const desksData = await getDeskData();
    await Promise.all(desksData.map(desk => setHeight(desk.id, val)));
    document.getElementById('height_all').value = val;
}

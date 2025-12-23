window.actionLocks = window.actionLocks || {};
window.adminLocks = window.adminLocks || {};
function lockDesk(id) { window.actionLocks[id] = true; }
function unlockDesk(id) { delete window.actionLocks[id]; }

// Block if admin-locked and current user is not admin
async function lockedAction(id, action) {
    const d = Array.isArray(desks) ? desks.find(x => String(x.id) === String(id)) : null;
    const isAdminUser = d && !!d.is_admin;
    if (window.adminLocks && window.adminLocks[id] && !isAdminUser) {
        showPopup(`Desk ${id} is admin-locked`);
        return;
    }
    if (window.actionLocks && window.actionLocks[id]) return; // prevent concurrent actions
    lockDesk(id);
    try {s
        await action();
        await fetchDesks();
    } finally {
        unlockDesk(id);
    }
}
window.lockAll = false;
var desks = [];

function updateClock() {
    const now = new Date();
    const pad = n => n.toString().padStart(2, '0');
    const str = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    document.getElementById('clock').textContent = str;
}

function showPopup(message) {
    const popupContainer = document.getElementById("system-popups");
    const popup = document.createElement("div");
    popup.className = "popup-message";
    popup.textContent = message;
    popupContainer.appendChild(popup);
    setTimeout(() => popup.remove(), 3000); // auto remove after 3s
}

async function updateFavoriteLabel(deskId) {
    try {
        const r = await fetch(`/api/desks/${deskId}/favorite`);
        if (!r.ok) return;
        const data = await r.json();
        const el = document.getElementById(`fav_label_${deskId}`);
        if (!el) return;
        if (data && typeof data.favorite === 'number') {
            el.textContent = `Favorite: ${data.favorite}`;
        } else {
            el.textContent = 'Favorite: —';
        }
    } catch (e) {
    }
}

 // Admin lock: prevents non-admin users from performing actions on this desk
async function toggleLock(id) {
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

function toggleLockAll() {
    const btn = document.getElementById('lock_all');
    if (!window.lockAll) {
        fetch('/api/desks/admin_lock_all', { method: 'POST' })
            .then(r => {
                if (!r.ok) throw new Error('lock-all failed');
                window.lockAll = true;
                btn.textContent = "Unlock All";
                desks.forEach(d => lockDeskUI(d.id));
                showPopup("All desks locked by admin");
            })
            .catch(e => { console.error(e); showPopup('Action failed'); });
    } else {
        fetch('/api/desks/admin_unlock_all', { method: 'POST' })
            .then(r => {
                if (!r.ok) throw new Error('unlock-all failed');
                window.lockAll = false;
                btn.textContent = "Lock All";
                desks.forEach(d => unlockDeskUI(d.id));
                showPopup("All desks unlocked");
            })
            .catch(e => { console.error(e); showPopup('Action failed'); });
    }
}

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

function unlockDeskUI(id) {
    const card = document.getElementById(`desk_card_${id}`);
    if (!card) return;
    card.classList.remove("locked");
    card.querySelectorAll("button, input").forEach(el => el.disabled = false);
    card.querySelector(".lock-btn").disabled = false;
    card.querySelector(".lock-btn").textContent = "Lock Desk";
}

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
                    errorDivInit.style.display = 'block';
                    errorDivInit.classList.add('no-error');
                    errorDivInit.textContent = 'No current error';
                }
            }


            // Favorite buttons
            if (!document.getElementById(`fav_save_${d.id}`)) {
                const favSave = document.createElement('button');
                favSave.id = `fav_save_${d.id}`;
                favSave.className = 'btn btn-fav-save';
                favSave.textContent = 'Save Favorite';
                favSave.onclick = async () => {
                    try {
                        await fetch(`/api/desks/${d.id}/favorite/save`, { method: 'POST' });
                        showPopup(`Saved favorite for ${d.id}`);
                    } catch { showPopup('Save failed'); }
                };
                card.appendChild(favSave);
            }
            if (!document.getElementById(`fav_go_${d.id}`)) {
                const favGo = document.createElement('button');
                favGo.id = `fav_go_${d.id}`;
                favGo.className = 'btn btn-fav-go';
                favGo.textContent = 'Go Favorite';
                favGo.onclick = async () => {
                    try {
                        await fetch(`/api/desks/${d.id}/favorite/go`, { method: 'POST' });
                        await fetchDesks();
                        showPopup(`Moved ${d.id} to favorite`);
                    } catch { showPopup('Move failed'); }
                };
                card.appendChild(favGo);
            }

            // Assign IDs to inputs/buttons
            card.querySelector('.height-input').id = `height_${d.id}`;
            card.querySelector('.hour-input').id = `hour_${d.id}`;
            card.querySelector('.minute-input').id = `minute_${d.id}`;
            card.querySelector('.sched-height-input').id = `sched_height_${d.id}`;
            card.querySelector('.lock-btn').id = `lock_${d.id}`;

            // Button handlers
            card.querySelector('.btn-up').onclick = () => lockedAction(d.id, () => move(d.id, 'up'));
            card.querySelector('.btn-down').onclick = () => lockedAction(d.id, () => move(d.id, 'down'));
            card.querySelector('.btn-sit').onclick = () => lockedAction(d.id, () => goToPreset(d.id, "sit"));
            card.querySelector('.btn-stand').onclick = () => lockedAction(d.id, () => goToPreset(d.id, "stand"));
            card.querySelector('.btn-step').onclick = () => lockedAction(d.id, () => setHeight(d.id));
            card.querySelector('.schedule-btn').onclick = () => lockedAction(d.id, () => schedule(d.id));
            card.querySelector('.lock-btn').onclick = () => toggleLock(d.id);

            // Favorite label
            if (!document.getElementById(`fav_label_${d.id}`)) {
                const favLbl = document.createElement('div');
                favLbl.id = `fav_label_${d.id}`;
                favLbl.className = 'desk-favorite';
                favLbl.textContent = 'Favorite: —';
                card.appendChild(favLbl);
                updateFavoriteLabel(d.id);
            }

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

            // Refresh favorite label
            updateFavoriteLabel(d.id);

            // Update error/status display
            const errorDiv = card.querySelector('.desk-error');
            const hasStatus = d.status && d.status !== 'Normal';
            if (errorDiv) {
                if (hasStatus && d.currentError) {
                    const ce = d.currentError;
                    let text = d.status;
                    if (ce && ce.errorCode) text += ` - Error ${ce.errorCode}`;
                    errorDiv.style.display = 'block';
                    errorDiv.classList.remove('no-error');
                    errorDiv.textContent = text;
                } else {
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
                card.classList.remove('locked');
                card.querySelectorAll('button, input').forEach(el => el.disabled = false);
            }
        }

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

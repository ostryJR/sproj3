// Simple lock andunlock helpers
function lockDesk(id) { window.lockIntervals[id] = true; }
function unlockDesk(id) { delete window.lockIntervals[id]; }

async function lockedAction(id, action) {
    lockDesk(id);
    unlockDesk(id);
    await action();
    lockDesk(id);
}

// Lock Height Feature
window.lockIntervals = window.lockIntervals || {};


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
    // to avoid system error fetchDesks expects a desks array but setHeight() calls it with no args
    if (!desks) {
        desks = await getDeskData();
    }
    const container = document.getElementById("desks");
    const currentDeskIds = new Set(desks.map(d => d.id));

    // Hide or show global controls based on admin status
    const isAdmin = desks && desks.length ? desks.some(x => !!x.is_admin) : false;
    const allControls = document.querySelector('.all-desks-control');
    if (allControls) {
        allControls.style.display = isAdmin ? '' : 'none';
    }
    // If a non-admin somehow has lockAll running, stop it when hiding controls
    if (!isAdmin && window.lockAllInterval) {
        clearInterval(window.lockAllInterval);
        window.lockAllInterval = null;
        const lockBtn = document.getElementById('lock_all');
        if (lockBtn) lockBtn.textContent = 'Lock All';
    }
    desks.forEach(d => {
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
            card.querySelector('.btn-sit').onclick = () => lockedAction(d.id, () => goToPreset(d.id, 'sit'));
            card.querySelector('.btn-stand').onclick = () => lockedAction(d.id, () => goToPreset(d.id, 'stand'));
            card.querySelector('.btn-step').onclick = () => lockedAction(d.id, () => setHeight(d.id));
            card.querySelector('.schedule-btn').onclick = () => lockedAction(d.id, () => schedule(d.id));
            // Lock button is visible but non-functional for now
            card.querySelector('.lock-btn').onclick = null;
            card.querySelector('.schedule-btn').onclick = () => schedule(d.id);

            // Inputs
            card.querySelector('.height-input').id = `height_${d.id}`;
            card.querySelector('.hour-input').id = `hour_${d.id}`;
            card.querySelector('.minute-input').id = `minute_${d.id}`;
            card.querySelector('.sched-height-input').id = `sched_height_${d.id}`;
            card.querySelector('.lock-btn').id = `lock_${d.id}`;

            // Hide Lock and Schedule controls for non-admin users
            if (!d.is_admin) {
                const lockGroup = card.querySelector('.lock-btn')?.closest('.control-group');
                if (lockGroup) lockGroup.style.display = 'none';
                const schedGroup = card.querySelector('.schedule-btn')?.closest('.control-group');
                if (schedGroup) schedGroup.style.display = 'none';
            }

            container.appendChild(card);
        } else {
            // Update dynamic values
            const posSpan = card.querySelector('.pos');
            if (posSpan) posSpan.textContent = d.position;

            // Update error/status display
            const errorDiv = card.querySelector('.desk-error');
            const hasStatus = d.status && d.status !== 'Normal';
            const hasErrors = Array.isArray(d.lastErrors) && d.lastErrors.length > 0;
            if (errorDiv) {
                // current errors (status != Normal) Otherwise  'No current error'
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
    // Process popups for any new or resolved errors
    try { processPopups(desks); } catch (e) { console.error('Popup processing failed', e); }
    getSchedule("all");
}

async function updatePage() {
    desks = await getDeskData();
    fetchDesks(desks);
    updateSchedule(desks);
    updateCharts(desks);
}

var desks = [];

// Control all desks at once
async function setHeightAll() {
    const val = document.getElementById('height_all').value;
    if (!val || isNaN(val)) {
        alert("Please enter a valid height.");
        return;
    }
    const desks = await getDeskData();
    await Promise.all(desks.map(desk => setHeight(desk.id, val)));
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
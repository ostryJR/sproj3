

// Lock Height Feature
window.lockIntervals = window.lockIntervals || {};
window.lockAllInterval = null;

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
            card.querySelector('.btn-up').onclick = () => move(d.id, 'up');
            card.querySelector('.btn-down').onclick = () => move(d.id, 'down');
            card.querySelector('.btn-step').onclick = () => setHeight(d.id);
            card.querySelector('.lock-btn').onclick = () => toggleLock(d.id);
            card.querySelector('.schedule-btn').onclick = () => schedule(d.id);

            container.appendChild(card);
        }
    });

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

/* System popup helpers */
function showPopup(d) {
    if (!d || !d.id) return;
    const container = document.getElementById('system-popups');
    if (!container) return;
    const id = `popup_${d.id}`;
    if (document.getElementById(id)) return;
    const el = document.createElement('div');
    el.id = id;
    el.className = 'system-popup';
    const msg = document.createElement('div');
    msg.className = 'msg';
    const code = d.currentError && d.currentError.errorCode ? ` - Error ${d.currentError.errorCode}` : '';
    msg.textContent = `${d.name}${code}`;
    const closeBtn = document.createElement('button');
    closeBtn.className = 'close';
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = () => resolvePopup(d.id);
    el.appendChild(msg);
    el.appendChild(closeBtn);
    container.appendChild(el);
}

function resolvePopup(deskId) {
    const el = document.getElementById(`popup_${deskId}`);
    if (!el) return;
    el.classList.add('resolved');
    const msg = el.querySelector('.msg');
    if (msg && !/resolved/i.test(msg.textContent)) msg.textContent = `${msg.textContent} (resolved)`;
    // fade out after 3s and remove
    setTimeout(() => {
        if (!el) return;
        el.classList.add('fadeout');
        setTimeout(() => { el.remove(); }, 600);
    }, 3000);
}

function processPopups(desks) {
    window._prevDeskStatus = window._prevDeskStatus || {};
    // On first run, initialize states but don't show popups for existing errors
    if (!window._popupsInitialized) {
        desks.forEach(d => { window._prevDeskStatus[d.id] = d.status || 'Normal'; });
        window._popupsInitialized = true;
        return;
    }
    desks.forEach(d => {
        const prev = window._prevDeskStatus[d.id] || 'Normal';
        const curr = d.status || 'Normal';
        if (prev === 'Normal' && curr !== 'Normal') {
            showPopup(d);
        } else if (prev !== 'Normal' && curr === 'Normal') {
            resolvePopup(d.id);
        }
        window._prevDeskStatus[d.id] = curr;
    });
}

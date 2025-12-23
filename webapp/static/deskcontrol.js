async function move(id, dir) {
    if ((window.adminLocks && window.adminLocks[id]) || window.lockAll) {
        alert("Desk is locked");
        return;
    }

    const step = 50;
    const resp = await fetch(`/api/desks/${id}/${dir}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step })
    });
    let data = null;
    try { data = await resp.json(); } catch (e) { /* ignore */ }
    await fetchDesks();
    return data;
}

async function setHeight(id) {
    if ((window.adminLocks && window.adminLocks[id]) || window.lockAll) {
        alert("Desk is locked");
        return;
    }

    let val;
    if (arguments.length > 1 && arguments[1] !== undefined) {
        val = arguments[1];
    } else {
        val = document.getElementById(`height_${id}`).value;
    }
    if (!val || isNaN(val)) {
        alert("Please enter a valid height.");
        return;
    }
    console.log(`Setting desk ${id} to height: ${val}`);
    try {
        // one request, then refresh UI
        const resp = await fetch(`/api/desks/${id}/set`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ height: val })
        });
        let text = '';
        try { text = await resp.text(); } catch (e) { text = '' }
        console.log('setHeight response', resp.status, text);
        if (!resp.ok) {
            alert(`Set failed: ${resp.status} ${text}`);
            return;
        }
        await fetchDesks();
    } catch (e) {
        alert("Failed to set height: " + e);
    }
}

async function goToPreset(id, preset) {
    try {
        for (let i = 0; i < 5; i++) {
            const resp = await fetch(`/api/desks/${id}/set`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ height: preset=="sit" ? document.getElementById("presetHeightSit").value : document.getElementById("presetHeightStand").value }) });
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

    await new Promise(res => setTimeout(res, 1000));
    await fetchDesks();

}
function toggleLockUIOnly(id) {
    const card = document.getElementById(`desk_card_${id}`);
    const btn = card?.querySelector(".lock-btn");
    if (!card || !btn) return;
    const locked = card.classList.toggle("locked");
    card.querySelectorAll("button, input").forEach(el => {
        if (el.classList.contains("lock-btn")) return;
        el.disabled = locked;
    });
    btn.disabled = false;
    btn.textContent = locked ? "Unlock Desk" : "Lock Desk";
    showPopup(`Desk ${id} ${locked ? 'locked' : 'unlocked'}`);
}

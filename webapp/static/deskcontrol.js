async function move(id, dir) {
    if (window.lockIntervals[id] || window.lockAllInterval) {
        alert("Desk input is locked!");
        return;
    }

    const step = 50;
    await fetch(`/api/desks/${id}/${dir}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step })
    });
    await fetchDesks();
}

async function setHeight(id) {
    if (window.lockIntervals[id] || window.lockAllInterval) {
        alert("Desk input is locked!");
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
        for (let i = 0; i < 5; i++) {
            const resp = await fetch(`/api/desks/${id}/set`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ height: val })
            });
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

// -------------------------
// Toggle Lock (UI only, no height required)
// -------------------------
function toggleLock(id) {
    const card = document.getElementById(`desk_card_${id}`);
    const btn = card.querySelector(".lock-btn");

    if (!card || !btn) return;

    if (card.classList.contains("locked")) {
        // Unlock
        card.classList.remove("locked");
        card.querySelectorAll("button, input").forEach(el => el.disabled = false);
        btn.disabled = false;
        btn.textContent = "Lock Height";
        showPopup(`Desk ${id} unlocked`);
    } else {
        // Lock desk UI only
        card.classList.add("locked");
        card.querySelectorAll("button, input").forEach(el => {
            if (!el.classList.contains("lock-btn")) el.disabled = true;
        });
        btn.disabled = false;
        btn.textContent = "Unlock";
        showPopup(`Desk ${id} locked`);
    }
}

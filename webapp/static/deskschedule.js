async function schedule(id) {
    const h = document.getElementById(`hour_${id}`).value;
    const m = document.getElementById(`minute_${id}`).value;
    const val = document.getElementById(`sched_height_${id}`).value;
    await fetch(`/api/desks/${id}/schedule`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hour: h, minute: m, height: val }) });
    alert("Scheduled!");
}

async function getSchedule(desk_id) {
    const resp = await fetch(`/api/desks/get_schedule`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ desk_id: desk_id }) });
    const data = await resp.json();
    // console.log(data);
    return data;
}

async function updateSchedule(desks) {
    console.log("Updating schedule...");
    const { schedule } = await getSchedule("all");
    const desksdata = await getDeskData();
    console.log(desksdata);
    console.log(schedule);

    const container = document.getElementById("schedule");
    container.innerHTML = `
    <h2>Desk Schedule</h2>
    <table>
            <thead>
                <tr>
                    <th>Desk Name (ID)</th>
                    <th>Time</th>
                    <th>Height</th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>`;
    const tbody = container.querySelector("tbody");
    schedule.forEach(desk => {
        desk_name = ""
        if(desk.desk_id=='All'){
            desk_name = "All"
        }else{
            desk_name = desksdata.find(d => (d.id).split(":").join("") == (desk.desk_id).split("_")[0]).name;
        }
        const row = document.createElement("tr");
        row.innerHTML = `
            <td><b>${desk_name}</b> (${desk.desk_id})</td>
            <td>${(desk.hour).toString().padStart(2, "0")}:${(desk.minute).toString().padStart(2, "0")}</td>
            <td>${desk.height}</td>
        `;
        tbody.appendChild(row);
    });
}

// --- Auto lock/unlock after/before schedule ---
window.scheduleLockTimeouts = window.scheduleLockTimeouts || {};
window.scheduleUnlockTimeouts = window.scheduleUnlockTimeouts || {};

async function setupAutoLockUnlockForDesk(deskId) {
    // Clear any previous timeouts
    if (window.scheduleLockTimeouts[deskId]) {
        clearTimeout(window.scheduleLockTimeouts[deskId]);
    }
    if (window.scheduleUnlockTimeouts[deskId]) {
        clearTimeout(window.scheduleUnlockTimeouts[deskId]);
    }
    // Get all schedules for this desk
    const { schedule } = await getSchedule(deskId);
    if (!schedule || schedule.length === 0) return;
    // Sort by next_run_time
    const now = new Date();
    const futureSchedules = schedule
        .map(s => ({...s, next: new Date(s.next_run_time)}))
        .filter(s => s.next > now)
        .sort((a, b) => a.next - b.next);
    if (futureSchedules.length === 0) return;
    // Next scheduled move
    const next = futureSchedules[0];
    // Time until next schedule
    const msUntilNext = next.next - now;
    // Auto-unlock 10s before next schedule
    if (msUntilNext > 10000) {
        window.scheduleUnlockTimeouts[deskId] = setTimeout(() => {
            if (window.lockIntervals[deskId]) {
                clearInterval(window.lockIntervals[deskId]);
                delete window.lockIntervals[deskId];
                const btn = document.getElementById(`lock_${deskId}`);
                if (btn) btn.textContent = "🔒 Lock Height";
                console.log(`Auto-unlocked desk ${deskId} before next schedule`);
            }
        }, msUntilNext - 10000);
    }
    // Auto-lock right after scheduled move (1s after)
    window.scheduleLockTimeouts[deskId] = setTimeout(() => {
        // Get scheduled height
        const schedHeight = next.height;
        if (!window.lockIntervals[deskId]) {
            window.lockIntervals[deskId] = setInterval(async () => {
                try {
                    await fetch(`/api/desks/${deskId}/set`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ height: schedHeight })
                    });
                } catch (e) {
                    console.error(`Lock Height failed for desk ${deskId}:`, e);
                }
            }, 1000);
            const btn = document.getElementById(`lock_${deskId}`);
            if (btn) btn.textContent = "🔓 Unlock";
            console.log(`Auto-locked desk ${deskId} after schedule`);
        }
        // Setup for next schedule recursively
        setupAutoLockUnlockForDesk(deskId);
    }, msUntilNext + 1000);
}

// Patch schedule() to also setup auto lock/unlock
const origSchedule = schedule;
schedule = async function(id) {
    await origSchedule(id);
    setupAutoLockUnlockForDesk(id);
}
// Also call setupAutoLockUnlockForDesk for all desks on page load
window.addEventListener('DOMContentLoaded', async () => {
    const desks = await getDeskData();
    for (const desk of desks) {
        setupAutoLockUnlockForDesk(desk.id);
    }
});
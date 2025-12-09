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
    // const desks = await getDeskData();
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
    schedule.forEach(s => {
        const desk = desks.find(d => d.id == s.desk_id);
        const row = document.createElement("tr");
        row.innerHTML = `
            <td><b>${desk.name}</b> (${desk.id})</td>
            <td>${(s.hour).toString().padStart(2, "0")}:${(s.minute).toString().padStart(2, "0")}</td>
            <td>${s.height}</td>
        `;
        tbody.appendChild(row);
    });
}
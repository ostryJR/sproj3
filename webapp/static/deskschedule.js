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
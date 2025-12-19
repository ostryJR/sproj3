let lineChart = null;
let stateDonutChart = null;
let CURRENT_DESK_ID = null;
let IS_ADMIN = false;

// get desk of current user
async function loadCurrentUserDesk() {
    const res = await fetch('/api/me');
    if (!res.ok) {
        throw new Error('Not authenticated');
    }

    const user = await res.json();

    CURRENT_DESK_ID = user.desk_id;
    IS_ADMIN = user.is_admin;

    if (IS_ADMIN) {
        await initDeskSwitcher();
    }
}

// function for the admin to choose desks for graphs

async function initDeskSwitcher() {
    const container = document.getElementById('deskSwitcherContainer');
    const select = document.getElementById('deskSwitcher');

    container.style.display = 'block';

    const desks = await getDeskData();

    select.innerHTML = '';

    desks.forEach(desk => {
        const option = document.createElement('option');
        option.value = desk.id;
        option.textContent = desk.name || desk.id;
        select.appendChild(option);
    });

    // Default selection
    select.value = CURRENT_DESK_ID;

    select.addEventListener('change', () => {
        switchDesk(select.value);
    });
}

// ensures that data from previous selected desks dont remain on the graph
function resetChartState() {
    datasetsState.green.length = 0;
    datasetsState.blue.length = 0;
    datasetsState.red.length = 0;
    datasetsState.transition.length = 0;

    lastState = null;

    lineChart.update();
    updateStateDonut();
    updateDebugPanel();
}

function switchDesk(newDeskId) {
    if (newDeskId === CURRENT_DESK_ID) return;

    CURRENT_DESK_ID = newDeskId;
    resetChartState();
}

async function updateCharts() {
    const desks = await getDeskData();

    var errorsDict = {};
    for (var desk of desks) {
        for (var error of desk.lastErrors) {
            errorsDict[error.errorCode] = (errorsDict[error.errorCode] || 0) + 1;
        }
    }
    // console.log("errors");
    // console.log(errorsDict);

    const ctx = document.getElementById('myChart');
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: Object.values(errorsDict)
            }],
            labels: Object.keys(errorsDict)
        },
        options: {
            plugins: {
                title: {
                    display: true,
                    text: 'Errors Code Distribution'
                }
            }
        }
    });
}

function getState(v) {
    if (v > 100) return 'STANDING';
    if (v >= 85) return 'NEUTRAL';
    return 'SITTING';
}

let lastState = null;

const datasetsState = {
    green: [],
    blue: [],
    red: [],
    transition: []
};

function addLivePoint(height) {
    const now = Date.now();
    const state = getState(height);

    const { green, blue, red, transition } = datasetsState;

    // Every color exists, this ensures that a point exists only if it has a y value, otherwise it's not deifined, thus not shown
    green.push({ x: now, y: NaN });
    blue.push({ x: now, y: NaN });
    red.push({ x: now, y: NaN });
    transition.push({ x: now, y: NaN });

    // Assign current value to exactly one dataset
    if (state === 'STANDING') green.at(-1).y = height;
    else if (state === 'NEUTRAL') blue.at(-1).y = height;
    else red.at(-1).y = height;

    // Transition
    if (lastState !== null && lastState !== state) {
        transition.at(-1).y = height;
    }

    lastState = state;

    const containerBody3 = document.querySelector('.containerBody3');
    const totalPoints = green.length + blue.length + red.length;

    if (totalPoints <= 5) {
        containerBody3.style.width = '500px';
    } else if (totalPoints <= 10) {
        containerBody3.style.width = '1500px';
    } else if (totalPoints <= 15) {
        containerBody3.style.width = '3500px';
    }
    else {
        containerBody3.style.width = '5000px';
    }

}


// line chart

function initLineChart() {

    if (lineChart) return;

    const ctx = document.getElementById('lineChart');

    lineChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [
                {
                    label: 'Standing',
                    data: datasetsState.green,
                    borderColor: 'green',
                    borderWidth: 3
                },
                {
                    label: 'Neutral',
                    data: datasetsState.blue,
                    borderColor: 'blue',
                    borderWidth: 3
                },
                {
                    label: 'Sitting',
                    data: datasetsState.red,
                    borderColor: 'red',
                    borderWidth: 3
                },
                {
                    label: 'Transition',
                    data: datasetsState.transition,
                    borderColor: 'gray',
                    showLine: false,
                    borderDash: [5, 5],
                    borderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            elements: {
                point: { radius: 4 }
            },
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: false,
                    text: 'Desk Position Chart'
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'second',
                        displayFormats: {
                            second: 'HH:mm:ss'
                        }
                    },
                    ticks: {
                        autoSkip: false,
                        /*maxTicksLimit: 10*/
                    }
                }
            }
        }
    });
}

//donut chart

function initStateDonutChart() {
    const ctx = document.getElementById('myChart2');

    stateDonutChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Standing', 'Neutral', 'Sitting'],
            datasets: [{
                data: [0, 0, 0],
                backgroundColor: ['green', 'blue', 'red']
            }]
        },
        options: {
            plugins: {
                title: {
                    display: true,
                    text: 'Desk State Distribution (%)'
                }
            }
        }
    });
}

// 2 following functions for point counting from graph
function countValid(dataset) {
    let count = 0;
    for (const p of dataset) {
        if (typeof p.y === 'number' && !isNaN(p.y)) {
            count++;
        }
    }
    return count;
}

function computeTimeMs(dataset) {
    let time = 0;

    for (let i = 1; i < dataset.length; i++) {
        const prev = dataset[i - 1];
        const curr = dataset[i];

        if (
            typeof prev.y === 'number' && !isNaN(prev.y) &&
            typeof curr.y === 'number' && !isNaN(curr.y)
        ) {
            time += curr.x - prev.x;
        }
    }

    return time;
}

function formatDuration(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}m ${seconds}s`;
}

function updateDebugPanel() {
    const standingMs = computeTimeMs(datasetsState.green);
    const neutralMs = computeTimeMs(datasetsState.blue);
    const sittingMs = computeTimeMs(datasetsState.red);
    const transMs = computeTimeMs(datasetsState.transition);

    document.getElementById('dbgStanding').textContent = formatDuration(standingMs);
    document.getElementById('dbgNeutral').textContent = formatDuration(neutralMs);
    document.getElementById('dbgSitting').textContent = formatDuration(sittingMs);
    document.getElementById('dbgTransitions').textContent = formatDuration(transMs);
}



// function for percentages

function getStateMetrics() {
    const standing = countValid(datasetsState.green);
    const neutral = countValid(datasetsState.blue);
    const sitting = countValid(datasetsState.red);
    const transitions = countValid(datasetsState.transition);

    const total = standing + neutral + sitting;

    // Avoid division by zero
    if (total === 0) {
        return {
            standing: 0,
            neutral: 0,
            sitting: 0,
            transitions: 0,
            percentages: {
                standing: 0,
                neutral: 0,
                sitting: 0
            }
        };
    }

    return {
        standing,
        neutral,
        sitting,
        transitions,
        percentages: {
            standing: +(standing / total * 100).toFixed(1),
            neutral: +(neutral / total * 100).toFixed(1),
            sitting: +(sitting / total * 100).toFixed(1)
        }
    };
}

function updateStateDonut() {
    if (!stateDonutChart) return;

    const metrics = getStateMetrics();

    stateDonutChart.data.datasets[0].data = [
        metrics.percentages.standing,
        metrics.percentages.neutral,
        metrics.percentages.sitting
    ];

    stateDonutChart.update('none');
}



async function getDeskHeight() {
    try {
        const desks = await getDeskData();
        const myDesk = desks.find(d => d.id === CURRENT_DESK_ID);

        if (!myDesk) {
            console.warn('My desk not found');
            return;
        }

        //  mm -> convert to cm
        const heightCm = myDesk.position / 10;

        addLivePoint(heightCm);
        updateDebugPanel();
        updateStateDonut();
        lineChart.update('none');

    } catch (err) {
        console.error('Failed to poll desk height', err);
    }
}


function createLegend(chart) {
    const legend = document.getElementById('lineLegend');
    legend.innerHTML = '';

    chart.data.datasets.forEach(ds => {
        const item = document.createElement('div');
        item.className = 'legendItem';

        const color = document.createElement('span');
        color.className = 'legendColor';
        color.style.backgroundColor = ds.borderColor;

        const label = document.createElement('span');
        label.textContent = ds.label;

        item.appendChild(color);
        item.appendChild(label);
        legend.appendChild(item);
    });
}



// Start everything
document.addEventListener('DOMContentLoaded', async () => {
    updateCharts();
    initLineChart();
    initStateDonutChart();

    createLegend(lineChart);
    lineChart.update();

    await loadCurrentUserDesk();

    setInterval(getDeskHeight, 3000);
});
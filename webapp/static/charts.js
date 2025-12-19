let lineChart = null;
let stateDonutChart = null;
let MY_DESK_ID = null;



// get desk of current user

async function loadCurrentUserDesk() {
    const res = await fetch('/api/me');
    if (!res.ok) {
        throw new Error('Not authenticated');
    }

    const user = await res.json();
    MY_DESK_ID = user.desk_id;
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



//const MY_DESK_ID = '00:ec:eb:50:c2:c8'; // hard-coded desk

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

function updateDebugPanel() {
    const standing = countValid(datasetsState.green);
    const neutral = countValid(datasetsState.blue);
    const sitting = countValid(datasetsState.red);
    const trans = countValid(datasetsState.transition);

    document.getElementById('dbgStanding').textContent = standing;
    document.getElementById('dbgSitting').textContent = sitting;
    document.getElementById('dbgTransitions').textContent = trans;
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
        const myDesk = desks.find(d => d.id === MY_DESK_ID);

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
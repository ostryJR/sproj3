console.log('charts.js loaded');




let myChart = null;
let myChart2 = null;
let lineChart = null;

const genericOptions = {
    fill: false,
    interaction: {
        intersect: false
    },
    radius: 0
};

async function updateCharts() {
    let desks = [];
    try {
        desks = await getDeskData();
    } catch (e) {
        console.warn('getDeskData failed, skipping doughnut charts');
    }
    // ---------- Doughnut chart 1 ----------
    const errorsDict = {};
    for (const desk of desks) {
        for (const error of desk.lastErrors) {
            errorsDict[error.errorCode] =
                (errorsDict[error.errorCode] || 0) + 1;
        }
    }

    const labels = Object.keys(errorsDict);
    const values = Object.values(errorsDict);

    if (!myChart) {
        const ctx = document.getElementById('myChart');
        myChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{ data: values }]
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
    } else {
        myChart.data.labels = labels;
        myChart.data.datasets[0].data = values;
        myChart.update();
    }

    // ---------- Doughnut chart 2 ----------
    if (!myChart2) {
        const ctx2 = document.getElementById('myChart2');
        myChart2 = new Chart(ctx2, {
            type: 'doughnut',
            data: {
                labels: ['Red', 'Yellow', 'Blue'],
                datasets: [{ data: [10, 20, 30] }]
            }
        });
    }


}

/***********************
     * SLIDING WINDOW
     ***********************/
function trimOldPoints(seconds) {
    const cutoff = Date.now() - seconds * 1000;

    Object.values(datasetsState).forEach(arr => {
        while (arr.length && arr[0].x < cutoff) {
            arr.shift();
        }
    });
}

/***********************
* STATE DEFINITIONS
***********************/
const STANDING = v => v > 100;
const NEUTRAL = v => v <= 100 && v >= 85;
const SITTING = v => v < 85;

/***********************
 * GLOBAL CHART STATE
 ***********************/

const datasetsState = {
    green: [],
    blue: [],
    red: [],
    transition: []
};

/***********************
 * ADD ONE LIVE POINT
 ***********************/
function addLivePoint(height) {
    const now = Date.now();

    const { green, blue, red, transition } = datasetsState;

    // Find previous value
    const lastValue =
        [...green, ...blue, ...red]
            .map(p => p?.y)
            .filter(v => v !== undefined)
            .at(-1);

    // Push default NaN points
    green.push({ x: now, y: NaN });
    blue.push({ x: now, y: NaN });
    red.push({ x: now, y: NaN });
    transition.push({ x: now, y: NaN });

    // Assign current state
    if (STANDING(height)) green.at(-1).y = height;
    else if (NEUTRAL(height)) blue.at(-1).y = height;
    else if (SITTING(height)) red.at(-1).y = height;

    // Detect transition
    if (lastValue !== undefined) {
        const changed =
            STANDING(lastValue) !== STANDING(height) ||
            NEUTRAL(lastValue) !== NEUTRAL(height) ||
            SITTING(lastValue) !== SITTING(height);

        if (changed) {
            transition.at(-1).y = height;
        }
    }

    //trimOldPoints(60); // keep last 60 seconds
}

/***********************
     * CHART INITIALIZATION
     ***********************/
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
                title: {
                    display: true,
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
                        autoSkip: true,
                        maxTicksLimit: 10
                    }
                }
            }
        }
    });
}



/***********************
    * LIVE UPDATE LOOP
    ***********************/

// Replace this with your real API call
function getCurrentDeskHeight() {
    return 70 + Math.random() * 60;
}

// Start everything
document.addEventListener('DOMContentLoaded', () => {
    updateCharts();
    initLineChart();

    // add an initial point immediately
    addLivePoint(90);
    addLivePoint(110);
    lineChart.update();

    const FIVE_MINUTES = 5 * 60 * 1000;
    setInterval(() => {
        const height = getCurrentDeskHeight();
        addLivePoint(height);
        lineChart.update('none');
    }, 200);
});
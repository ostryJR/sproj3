let lineChart = null;

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
    const ctx2 = document.getElementById('myChart2');
    new Chart(ctx2, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [10, 20, 30]
            }],
            labels: [
                'Red',
                'Yellow',
                'Blue'
            ]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Desk state definitions

const STANDING = v => v > 100;
const NEUTRAL = v => v <= 100 && v >= 85;
const SITTING = v => v < 85;

const datasetsState = {
    green: [],
    blue: [],
    red: [],
    transition: []
};

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

    const containerBody3 = document.querySelector('.containerBody3');
    const totalPoints = green.length + blue.length + red.length;

    if (totalPoints > 10) {
        containerBody3.style.width = `5000px`;
    }

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


const MY_DESK_ID = '00:ec:eb:50:c2:c8'; // hard-coded desk

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
document.addEventListener('DOMContentLoaded', () => {
    updateCharts();
    initLineChart();

    createLegend(lineChart);
    lineChart.update();

    setInterval(getDeskHeight, 3000);
});
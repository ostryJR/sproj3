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
    const ctx3 = document.getElementById('myChart3');
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
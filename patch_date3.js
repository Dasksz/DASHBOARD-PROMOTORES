const appFile = './js/app/app.js';
const fs = require('fs');

let content = fs.readFileSync(appFile, 'utf8');

const targetCheck = `            if (!isExcluded('date') && selectedCoverageDateRange.start && selectedCoverageDateRange.end) {
                // Ensure the start date is 00:00:00.000 in UTC to align with database DTPED
                const [startYear, startMonth, startDay] = selectedCoverageDateRange.start.split('-');
                const start = Date.UTC(parseInt(startYear), parseInt(startMonth) - 1, parseInt(startDay), 0, 0, 0, 0);

                // Ensure the end date is 23:59:59.999 in UTC to include all sales on the last day
                const [endYear, endMonth, endDay] = selectedCoverageDateRange.end.split('-');
                const end = Date.UTC(parseInt(endYear), parseInt(endMonth) - 1, parseInt(endDay), 23, 59, 59, 999);

                // Filter Sales (Current)
                sales = sales.filter(s => s.DTPED >= start && s.DTPED <= end);`;

if(content.includes(targetCheck)) {
    console.log("Check confirm");
} else {
    console.log("Not found");
}

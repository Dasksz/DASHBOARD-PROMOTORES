const appFile = './js/app/app.js';
const fs = require('fs');

let content = fs.readFileSync(appFile, 'utf8');

const oldLogic2 = `                // Calculate Proportional Previous Month Range
                const prevStart = new Date(start);
                prevStart.setMonth(prevStart.getMonth() - 1);

                const prevEnd = new Date(end);
                prevEnd.setMonth(prevEnd.getMonth() - 1);

                // Clamp end of month logic (auto-handled by setMonth but need to check if day overflowed)
                // e.g. 31 March -> 31 Feb -> 3 March (JS Date behavior). We want last day of Feb.
                // Fix: Check day.
                const checkOverflow = (orig, target) => {
                    if (orig.getDate() !== target.getDate()) {
                        target.setDate(0); // Set to last day of previous month
                    }
                };
                // Re-calculate strictly
                const strictPrevStart = new Date(selectedCoverageDateRange.start);
                const d1 = strictPrevStart.getDate();
                strictPrevStart.setMonth(strictPrevStart.getMonth() - 1);
                if (strictPrevStart.getDate() !== d1) strictPrevStart.setDate(0);

                const strictPrevEnd = new Date(selectedCoverageDateRange.end);
                const d2 = strictPrevEnd.getDate();
                strictPrevEnd.setMonth(strictPrevEnd.getMonth() - 1);
                if (strictPrevEnd.getDate() !== d2) strictPrevEnd.setDate(0);

                const pStart = strictPrevStart.getTime();
                const pEnd = strictPrevEnd.getTime();`;

const newLogic2 = `                // Calculate Proportional Previous Month Range
                // Re-calculate strictly based on UTC
                const [sYear, sMonth, sDay] = selectedCoverageDateRange.start.split('-').map(Number);
                const [eYear, eMonth, eDay] = selectedCoverageDateRange.end.split('-').map(Number);

                let pStartYear = sYear;
                let pStartMonth = sMonth - 1 - 1; // 0-indexed, minus 1 month
                if (pStartMonth < 0) { pStartMonth += 12; pStartYear--; }

                // Get days in prev month for start date clamping
                const daysInPrevStartMonth = new Date(Date.UTC(pStartYear, pStartMonth + 1, 0)).getUTCDate();
                const clampedStartDay = Math.min(sDay, daysInPrevStartMonth);
                const pStart = Date.UTC(pStartYear, pStartMonth, clampedStartDay, 0, 0, 0, 0);

                let pEndYear = eYear;
                let pEndMonth = eMonth - 1 - 1; // 0-indexed, minus 1 month
                if (pEndMonth < 0) { pEndMonth += 12; pEndYear--; }

                // Get days in prev month for end date clamping
                const daysInPrevEndMonth = new Date(Date.UTC(pEndYear, pEndMonth + 1, 0)).getUTCDate();
                const clampedEndDay = Math.min(eDay, daysInPrevEndMonth);
                const pEnd = Date.UTC(pEndYear, pEndMonth, clampedEndDay, 23, 59, 59, 999);`;

if (content.includes(oldLogic2)) {
    content = content.replace(oldLogic2, newLogic2);
    console.log("Old logic 2 replaced successfully.");
} else {
    console.log("Could not find the exact old logic 2.");
}

fs.writeFileSync(appFile, content);

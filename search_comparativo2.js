const fs = require('fs');
const file = fs.readFileSync('js/app/app.js', 'utf8');
const lines = file.split('\n');

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('comparison-view') || lines[i].includes('updateComparisonView')) {
        for (let j = i - 5; j <= i + 150; j++) {
            if (lines[j] && (lines[j].includes('707') || lines[j].includes('708') || lines[j].includes('mix') || lines[j].includes('Mix'))) {
                console.log(`Line ${j + 1}: ${lines[j]}`);
            }
        }
    }
}

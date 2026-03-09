const fs = require('fs');
const file = fs.readFileSync('js/app/app.js', 'utf8');
const lines = file.split('\n');

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('comparativo') || lines[i].includes('Comparativo') || lines[i].includes('COMPARATIVO') || lines[i].includes('comparison')) {
        for (let j = i - 2; j <= i + 10; j++) {
            if (lines[j] && (lines[j].includes('707') || lines[j].includes('708') || lines[j].includes('Mix') || lines[j].includes('mix'))) {
                console.log(`Line ${j + 1}: ${lines[j]}`);
            }
        }
    }
}

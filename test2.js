const fs = require('fs');
const file = fs.readFileSync('js/app/app.js', 'utf8');
const lines = file.split('\n');

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('ELMA Constraint: If ELMA_ALL')) {
        for (let j = i - 2; j <= i + 10; j++) {
            console.log(`Line ${j + 1}: ${lines[j]}`);
        }
        console.log('---');
    }
}

const fs = require('fs');

const file = fs.readFileSync('js/app/app.js', 'utf8');

const lines = file.split('\n');

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('ELMA_ALL') && lines[i].includes('includeInMix')) {
        console.log(`Line ${i + 1}: ${lines[i]}`);
        console.log(`Line ${i + 2}: ${lines[i + 1]}`);
        console.log(`Line ${i + 3}: ${lines[i + 2]}`);
        console.log(`Line ${i + 4}: ${lines[i + 3]}`);
        console.log(`Line ${i + 5}: ${lines[i + 4]}`);
        console.log(`Line ${i + 6}: ${lines[i + 5]}`);
        console.log(`Line ${i + 7}: ${lines[i + 6]}`);
    }
}

const fs = require('fs');
const content = fs.readFileSync('js/app/app.js', 'utf8');

// Look for ColumnarDataset._data accesses.
let usages = 0;
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('._data')) {
        console.log(`Line ${i+1}: ${lines[i].trim()}`);
        usages++;
    }
}
console.log(`Total _data usages: ${usages}`);

const fs = require('fs');
const file = fs.readFileSync('js/app/app.js', 'utf8');
const lines = file.split('\n');

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('pepsicoCodfors = new Set')) {
        for (let j = i - 10; j <= i + 15; j++) {
            console.log(`Line ${j + 1}: ${lines[j]}`);
        }
        console.log('---');
    }
}

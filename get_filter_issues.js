const fs = require('fs');

let content = fs.readFileSync('js/app/app.js', 'utf8');
let lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('filter(') && lines[i].includes('=')) {
        console.log(`${i+1}: ${lines[i].trim()}`);
    }
}

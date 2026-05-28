const fs = require('fs');
let app = fs.readFileSync('js/app/app.js', 'utf8');

const lines = app.split('\n');
let startIndex = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('function getActiveClientsData() {')) {
        startIndex = i;
        break;
    }
}

if (startIndex !== -1) {
    for (let j = startIndex + 60; j < startIndex + 80; j++) {
        console.log(`Line ${j+1}: ${lines[j]}`);
    }
}

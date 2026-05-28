const fs = require('fs');
let app = fs.readFileSync('js/app/app.js', 'utf8');

const lines = app.split('\n');
for (let i=0; i<lines.length; i++) {
    if (lines[i].includes('function getActiveClientsData() {')) {
        for (let j=i; j<i+60; j++) {
            console.log(lines[j]);
        }
        break;
    }
}

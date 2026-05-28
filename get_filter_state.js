const fs = require('fs');
let app = fs.readFileSync('js/app/app.js', 'utf8');

// search for `if (!state) return sourceClients;`
const lines = app.split('\n');
for(let i=0; i<lines.length; i++) {
    if (lines[i].includes('if (!state) return sourceClients;')) {
        for(let j=i-5; j<=i+15; j++) {
            console.log(lines[j]);
        }
        break;
    }
}

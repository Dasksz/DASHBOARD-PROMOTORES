const fs = require('fs');
const file = fs.readFileSync('js/app/app.js', 'utf8');
const lines = file.split('\n');

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('pepsicoCodfors = new Set')) {
        let functionName = '';
        for (let k = i; k >= 0; k--) {
            if (lines[k].includes('function ')) {
                functionName = lines[k].trim();
                break;
            }
        }
        console.log(`Line ${i + 1}: ${lines[i]} - Function: ${functionName}`);
    }
}

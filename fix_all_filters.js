const fs = require('fs');

function analyzeFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    const lines = content.split('\n');
    let occurrences = 0;

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('.filter(')) {
            // Context heuristic: is it acting on a potentially large array?
            if (lines[i].includes('data.filter') || lines[i].includes('clients.filter') ||
                lines[i].includes('sales.filter') || lines[i].includes('history.filter') ||
                lines[i].includes('allClientsData.filter')) {
                console.log(`Line ${i+1}: ${lines[i].trim()}`);
                occurrences++;
            }
        }
    }
    console.log(`Total usages found: ${occurrences}`);
}

analyzeFile('js/app/app.js');

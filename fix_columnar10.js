const fs = require('fs');

function analyzeFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    const lines = content.split('\n');
    let occurrences = 0;

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('function getActiveClientsData(')) {
            for (let j = i + 30; j < i + 60; j++) {
                console.log(`Line ${j+1}: ${lines[j].trim()}`);
            }
            break;
        }
    }
}

analyzeFile('js/app/app.js');

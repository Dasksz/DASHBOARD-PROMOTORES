const fs = require('fs');

function analyzeFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Check if other places do `sourceClients = sourceClients.filter(...)`
    const lines = content.split('\n');
    let usages = [];
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('Array.from') && lines[i].includes('.get(i)')) {
            usages.push(`Line ${i+1}: ${lines[i].trim()}`);
        }
    }
    console.log(usages.join('\n'));
}

analyzeFile('js/app/app.js');

const fs = require('fs');

function analyzeFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Look for Proxy class instantiations inside loops
    const lines = content.split('\n');
    let occurrences = 0;

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('new Proxy(')) {
            console.log(`Line ${i+1}: ${lines[i].trim()}`);
            occurrences++;
        }
    }
    console.log(`Total usages found: ${occurrences}`);
}

analyzeFile('js/app/utils.js');

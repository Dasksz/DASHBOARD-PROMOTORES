const fs = require('fs');

function analyzeFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Look for `.filter` and `.map` on dataset arrays
    const lines = content.split('\n');
    let occurrences = 0;

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].match(/clients\.filter\(/) || lines[i].match(/sales\.filter\(/) || lines[i].match(/history\.filter\(/)) {
            console.log(`Line ${i+1}: ${lines[i].trim()}`);
            occurrences++;
        }
    }
    console.log(`Total usages found: ${occurrences}`);
}

analyzeFile('js/app/app.js');

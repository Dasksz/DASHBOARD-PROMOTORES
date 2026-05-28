const fs = require('fs');

function analyzeFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Look for `.filter` and `.map` on dataset arrays
    const lines = content.split('\n');
    let occurrences = 0;

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('filter(') && lines[i].includes('dataset')) {
            console.log(`Line ${i+1}: ${lines[i].trim()}`);
            occurrences++;
        }
    }
    console.log(`Total dataset.filter found: ${occurrences}`);
}

analyzeFile('js/app/app.js');

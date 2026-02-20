const fs = require('fs');
const content = fs.readFileSync('js/app/app.js', 'utf8');
const lines = content.split('\n');

const searchString = 'product-performance-modal-close-btn';
const searchTable = 'coverage-table-body';

lines.forEach((line, index) => {
    if (line.includes(searchString)) {
        console.log(`Found modal close btn at line ${index + 1}`);
        // Print surrounding lines
        for(let i = index - 5; i <= index + 10; i++) {
            console.log(`${i+1}: ${lines[i]}`);
        }
    }
});

lines.forEach((line, index) => {
    if (line.includes(searchTable)) {
        console.log(`Found coverage table body at line ${index + 1}`);
         // Print surrounding lines if it looks like a rendering loop
         if (line.includes('innerHTML')) {
             for(let i = index - 20; i <= index + 50; i++) {
                 console.log(`${i+1}: ${lines[i]}`);
             }
         }
    }
});

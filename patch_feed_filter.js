const fs = require('fs');
let code = fs.readFileSync('js/app/feed_view.js', 'utf8');

// The replacement I used above for Filter 2 replaced the comment block entirely, but I want to make sure I didn't break the enclosing loop block.
// Let's check the lines around Filter 2.
const lines = code.split('\n');
const filter2Index = lines.findIndex(l => l.includes('// Filter 2: Role-based Visibility'));
const contextLines = lines.slice(Math.max(0, filter2Index - 10), filter2Index + 30);
console.log(contextLines.join('\n'));

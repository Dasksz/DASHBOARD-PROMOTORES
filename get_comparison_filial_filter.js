const fs = require('fs');
const code = fs.readFileSync('js/app/app.js', 'utf8');

const regex = /document\.getElementById\('comparison-filial-filter-dropdown'\)/g;
let match;
while ((match = regex.exec(code)) !== null) {
  const start = Math.max(0, match.index - 500);
  const end = Math.min(code.length, match.index + 1000);
  console.log(`Matched at index ${match.index}`);
  console.log(code.substring(start, end));
}

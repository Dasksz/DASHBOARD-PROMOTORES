const fs = require('fs');
const code = fs.readFileSync('js/app/app.js', 'utf8');

const regex = /const dropdown = document\.getElementById\('lp-filial-filter-dropdown'\);[\s\S]*?if\s*\(typeof window.setupGenericFilialFilterHandlers/g;
let match;
while ((match = regex.exec(code)) !== null) {
  console.log(`Matched at index ${match.index}`);
  console.log(match[0].substring(0, 500) + '...');
}

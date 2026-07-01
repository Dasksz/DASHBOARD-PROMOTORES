const fs = require('fs');
const code = fs.readFileSync('js/app/app.js', 'utf8');

const regex = /let filiais = new Set\(\);[\s\S]*?setupGenericFilialFilterHandlers[^\n]*/g;
let match;
while ((match = regex.exec(code)) !== null) {
  console.log(`Matched at index ${match.index}`);
  console.log(match[0].substring(0, 500) + '...');
}

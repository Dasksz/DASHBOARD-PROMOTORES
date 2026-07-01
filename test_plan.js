const fs = require('fs');

const code = fs.readFileSync('js/app/app.js', 'utf8');

const regex = /function setup[A-Za-z]+FilialFilterHandlers\(\) \{[\s\S]*?\}/g;
let match;
while ((match = regex.exec(code)) !== null) {
  console.log(`Matched function at index ${match.index}`);
  console.log(match[0].substring(0, 100) + '...');
}

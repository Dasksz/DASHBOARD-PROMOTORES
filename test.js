const fs = require('fs');
const content = fs.readFileSync('js/app/app.js', 'utf8');

let pCount = 0;
let inString = false, strChar = '';
for(let i=0; i<content.length; i++) {
  let c = content[i];
  if (c === '\\') { i++; continue; }
  if (c === "'" || c === '"' || c === '`') {
    if (!inString) { inString = true; strChar = c; }
    else if (c === strChar) { inString = false; }
  }
  if (!inString) {
    if (c === '(') pCount++;
    if (c === ')') pCount--;
  }
}
console.log("pCount=", pCount);

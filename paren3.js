const fs = require('fs');
const content = fs.readFileSync('js/app/app.js', 'utf8');

let stack = [];
let lines = content.split('\n');
let inString = false, strChar = '';

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  for(let j=0; j<line.length; j++) {
    let c = line[j];
    if (c === '\\') { j++; continue; }
    if ((c === "'" || c === '"' || c === '`')) {
      if (!inString) {
        inString = true;
        strChar = c;
      } else if (c === strChar) {
        inString = false;
      }
    }
    if (!inString) {
      if (c === '(') {
        stack.push({type: 'paren', line: i+1});
      } else if (c === ')') {
        let last = stack.filter(x => x.type === 'paren').pop();
        if (!last) {
          console.log(`Unmatched ) at line ${i+1}`);
        } else {
          stack.splice(stack.lastIndexOf(last), 1);
        }
      }
    }
  }
}

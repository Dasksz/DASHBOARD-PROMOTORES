const fs = require('fs');
const code = fs.readFileSync('js/app/app.js', 'utf8');

const regex = /function setupLpFilialFilterHandlers\(\) \{[\s\S]*?if\s*\(typeof window\.setupGenericFilialFilterHandlers === 'function'\) \{\s*window\.setupGenericFilialFilterHandlers\('lp', \(\) => handleLpFilterChange\(\{ excludeFilter: 'filial' \}\)\);\s*\}\s*\}/g;

let matches = [];
let match;
while ((match = regex.exec(code)) !== null) {
  matches.push({
    index: match.index,
    length: match[0].length,
    code: match[0]
  });
}

console.log(`Found ${matches.length} matches`);
if (matches.length > 0) {
    console.log(matches[0].code);
}

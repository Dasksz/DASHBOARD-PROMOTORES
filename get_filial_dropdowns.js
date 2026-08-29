const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');

const regex = /id="([a-zA-Z0-9-]+)-filial-filter-dropdown"/g;
let match;
const ids = [];
while ((match = regex.exec(content)) !== null) {
  ids.push(match[1]);
}
console.log("Filial dropdown prefixes found in index.html:");
console.log(ids);

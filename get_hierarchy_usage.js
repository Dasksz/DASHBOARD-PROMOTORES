const fs = require('fs');
let app = fs.readFileSync('js/app/app.js', 'utf8');
let match = app.match(/function getHierarchyFilteredClients[\s\S]*?return result;\s*\}/);
console.log(match[0]);

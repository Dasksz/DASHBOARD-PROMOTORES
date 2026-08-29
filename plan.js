const fs = require('fs');
const content = fs.readFileSync('js/app/app.js', 'utf8');
const search = /function setupLpFilialFilterHandlers\(\) \{[\s\S]*?if\s*\(typeof window\.setupGenericFilialFilterHandlers === 'function'\) \{[\s\S]*?\}\s*\}/g;
const match = search.exec(content);
if(match) {
    console.log("MATCH FOUND!");
    console.log(match[0].substring(0, 100));
} else {
    console.log("NO MATCH");
}

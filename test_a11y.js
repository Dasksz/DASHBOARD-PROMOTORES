const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

const regex = /<span class="text-slate-400 hover:text-white cursor-pointer text-2xl leading-none" onclick="closeResearchModal\(\)">&times;<\/span>/g;
const matches = [...html.matchAll(regex)];

if (matches.length > 0) {
    console.log("Found matches:");
    matches.forEach(m => console.log(m[0]));
} else {
    console.log("No matches found.");
}

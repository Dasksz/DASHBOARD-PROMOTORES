const fs = require('fs');
const file = 'js/app/feed_view.js';
let content = fs.readFileSync(file, 'utf8');
const lines = content.split('\n');
const start = lines.findIndex(l => l.includes('async function openFavoritesModal()'));
const end = lines.findIndex((l, i) => i > start && l.includes('function applyFavoritesFilter()'));
console.log(lines.slice(start, end).join('\n'));

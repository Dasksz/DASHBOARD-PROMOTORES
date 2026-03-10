const fs = require('fs');
const file = 'js/app/feed_view.js';
let content = fs.readFileSync(file, 'utf8');

// I need to use string manipulation correctly to replace the card html block since the regex failed or did something weird
// Let's check what happened
const count1 = (content.match(/card\.innerHTML = `/g) || []).length;
console.log('Matches found for card inner HTML:', count1);

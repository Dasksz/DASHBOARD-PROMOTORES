const fs = require('fs');
const code = fs.readFileSync('js/app/feed_view.js', 'utf8');

const regex = /id="feed-promotor-filter-dropdown"/g;
let match;
while ((match = regex.exec(code)) !== null) {
  const start = Math.max(0, match.index - 300);
  const end = Math.min(code.length, match.index + 300);
  console.log(`Matched at index ${match.index} in feed_view.js`);
  console.log(code.substring(start, end));
}

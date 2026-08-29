const fs = require('fs');
let code;
try {
  code = fs.readFileSync('js/app/app.js', 'utf8');
} catch (e) {
  try {
    code = fs.readFileSync('js/app/feed_view.js', 'utf8');
  } catch(e) {}
}

if (!code) {
  console.log("Could not find file");
  process.exit(1);
}

const regex = /document\.getElementById\('feed-filial-filter-dropdown'\)/g;
let match;
while ((match = regex.exec(code)) !== null) {
  const start = Math.max(0, match.index - 500);
  const end = Math.min(code.length, match.index + 1000);
  console.log(`Matched at index ${match.index} in app.js`);
  console.log(code.substring(start, end));
}

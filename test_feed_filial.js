const fs = require('fs');
const content = fs.readFileSync('js/app/feed_view.js', 'utf8');

const regex = /const filialRadios = document\.querySelectorAll\('input\[name="feed-filial"\]'\);[\s\S]*?\}\s*\}/g;
let match;
while ((match = regex.exec(content)) !== null) {
  console.log(`Matched at index ${match.index}`);
  console.log(match[0]);
}

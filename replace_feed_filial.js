const fs = require('fs');
const content = fs.readFileSync('js/app/feed_view.js', 'utf8');

const regex = /const filialRadios = document\.querySelectorAll\('input\[name="feed-filial"\]'\);[\s\S]*?if\(!e\.target\.closest\('#feed-promotor-filter-dropdown'\) && !e\.target\.closest\('#feed-promotor-filter-btn'\)\) \{\s*document\.getElementById\('feed-promotor-filter-dropdown'\)\?\.classList\.add\('hidden'\);\s*\}\s*\}\);/g;
let match = regex.exec(content);
if(match) {
    console.log("Matched the giant block!");
    console.log(match[0].length);
} else {
    console.log("Did not match block");
}

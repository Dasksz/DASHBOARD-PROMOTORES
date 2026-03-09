const regex = /\/\/ Building answers summary \(like Instagram captions\)[\s\S]*?card\.innerHTML = `/;
const fs = require('fs');
let code = fs.readFileSync('js/app/feed_view.js', 'utf8');
if (regex.test(code)) {
    console.log("Match found");
} else {
    console.log("No match");
}

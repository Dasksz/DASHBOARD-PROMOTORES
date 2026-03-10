const fs = require('fs');
const content = fs.readFileSync('js/app/feed_view.js', 'utf8');
try {
    new Function(content);
    console.log("feed_view.js syntax is OK");
} catch (e) {
    console.error("Syntax error in feed_view.js:", e);
}

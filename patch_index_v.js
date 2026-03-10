const fs = require('fs');
let code = fs.readFileSync('index.html', 'utf8');

// Increment script versions again to ensure cache bypass
const updatedIndex = code.replace(/init\.js\?v=\d+\.\d+\.\d+/g, "init.js?v=4.0.2")
                         .replace(/feed_view\.js\?v=\d+/g, "feed_view.js?v=5");
fs.writeFileSync('index.html', updatedIndex);
console.log("Updated index.html versions");

const fs = require('fs');

try {
    const code = fs.readFileSync('js/app/app.js', 'utf8');
    require('vm').createScript(code);
    console.log("app.js syntax is valid");
} catch(e) {
    console.log("app.js syntax error:", e);
}

const fs = require('fs');

const appJsPath = 'js/app/app.js';
let appJs = fs.readFileSync(appJsPath, 'utf8');

// Replace in calculateUnifiedMetrics
appJs = appJs.replace(
    "const pepsicoCodfors = new Set([window.SUPPLIER_CODES.ELMA[0], window.SUPPLIER_CODES.ELMA[1]]);",
    "const pepsicoCodfors = new Set([window.SUPPLIER_CODES.ELMA[0], window.SUPPLIER_CODES.ELMA[1], window.SUPPLIER_CODES.ELMA[2]]);"
);

// We need to run it twice in case there are multiple matches and replace only replaces the first one
appJs = appJs.replace(
    "const pepsicoCodfors = new Set([window.SUPPLIER_CODES.ELMA[0], window.SUPPLIER_CODES.ELMA[1]]);",
    "const pepsicoCodfors = new Set([window.SUPPLIER_CODES.ELMA[0], window.SUPPLIER_CODES.ELMA[1], window.SUPPLIER_CODES.ELMA[2]]);"
);

fs.writeFileSync(appJsPath, appJs, 'utf8');
console.log('Patched app.js successfully.');

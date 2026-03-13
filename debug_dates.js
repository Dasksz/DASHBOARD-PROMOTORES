const appFile = './js/worker.js';
const fs = require('fs');
let content = fs.readFileSync(appFile, 'utf8');

console.log(content.match(/salesDataRaw.forEach\(rawRow => \{.*?dtPed.*?\}\)/s));

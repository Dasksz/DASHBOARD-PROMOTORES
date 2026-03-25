const fs = require('fs');
let c = fs.readFileSync('js/app/app_part3.js', 'utf8');

const combined = 'async function z() { try {\n' + c + '\n}catch(e){}}';
try {
   new Function(combined);
   console.log('Valid with wrapper');
} catch (e) {
   console.log('Invalid:', e);
}

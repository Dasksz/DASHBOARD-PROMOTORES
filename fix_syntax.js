const fs = require('fs');
const file = 'js/app/feed_view.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/            }\n        }\n    }\n    }\n\n    function toggleResumo\(btnElement, visitId\) \{/, `            }\n        }\n    }\n\n    function toggleResumo(btnElement, visitId) {`);

fs.writeFileSync(file, content);
console.log('Fixed extra brace');

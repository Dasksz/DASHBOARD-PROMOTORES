const fs = require('fs');
const file = 'js/app/feed_view.js';
let content = fs.readFileSync(file, 'utf8');

// The contains operator in supabase-js might expect a formatted postgres array string or behaves unexpectedly.
// Since favoritado_por is an array of uuid (uuid[]), querying it with .contains('favoritado_por', [window.userId])
// should theoretically work, but if it's returning 87 when none are favorited, it might be ignoring the filter.
// A common fix is to use Postgres syntax .filter('favoritado_por', 'cs', \`{\${window.userId}}\`)
// Or just .contains('favoritado_por', \`{\${window.userId}}\`)

content = content.replace(
    `.contains('favoritado_por', [window.userId])`,
    `.filter('favoritado_por', 'cs', \`{\${window.userId}}\`)`
);

// We should also replace it in loadFeed just to be safe
content = content.replace(
    `query = query.contains('favoritado_por', [window.userId]);`,
    `query = query.filter('favoritado_por', 'cs', \`{\${window.userId}}\`);`
);

fs.writeFileSync(file, content);
console.log('Fixed counter logic.');

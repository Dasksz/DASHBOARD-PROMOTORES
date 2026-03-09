const fs = require('fs');
let code = fs.readFileSync('js/app/feed_view.js', 'utf8');

// The main card class name
code = code.replace(
    /card\.className = 'glass-card p-4 rounded-xl shadow-lg border border-slate-700\/50 hover:border-slate-600 transition-colors animate-fade-in-up';/,
    "card.className = 'glass-card p-4 rounded-xl shadow-lg border border-slate-700/50 hover:border-slate-600 transition-colors animate-fade-in-up max-w-md mx-auto w-full';"
);

// We need to also adjust the photo dimensions to fit the card well. Currently it's w-64 md:w-80. We can just make the photo full width inside the post.
code = code.replace(
    /<div class="relative flex-none w-64 h-64 md:w-80 md:h-80 rounded-lg overflow-hidden snap-center bg-slate-800 border border-slate-700\/50">/g,
    '<div class="relative flex-none w-full aspect-square rounded-lg overflow-hidden snap-center bg-slate-800 border border-slate-700/50">'
);

// Remove the condition for the location button so it always appears and handles empty coordinates gracefully.
code = code.replace(
    /const locationBtnHtml = \(visit\.latitude && visit\.longitude\) \? `/g,
    "const locationBtnHtml = `"
);
code = code.replace(
    /<\/button>\n\s*` : '';/g,
    "</button>\n                        `;"
);

fs.writeFileSync('js/app/feed_view.js', code);
console.log('Feito patch feed layout');

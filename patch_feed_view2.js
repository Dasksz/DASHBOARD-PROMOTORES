const fs = require('fs');
let code = fs.readFileSync('js/app/feed_view.js', 'utf8');

// The badge HTML is: <div class="absolute bottom-2 right-2 ...
// The location button HTML is: <button onclick="window.FeedVisitas.openLocationModal..." class="absolute top-2 right-2 ...
// The image has: z-10

code = code.replace(
    /class="absolute bottom-2 right-2 px-2 py-1/g,
    'class="absolute bottom-2 left-2 z-20 px-2 py-1' // Move to left to make space for arrow, add z-20
);

code = code.replace(
    /class="absolute top-2 right-2 bg-black\/50/g,
    'class="absolute top-2 right-2 z-20 bg-black/50' // Add z-20
);

fs.writeFileSync('js/app/feed_view.js', code);

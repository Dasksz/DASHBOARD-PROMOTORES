const fs = require('fs');
let code = fs.readFileSync('js/app/feed_view.js', 'utf8');

// The user is saying that for supervisors and sellers, posts are not showing up.
// Looking at feed_view.js, there is a filtering logic inside `renderPosts` or `fetchFeedData`.

const getPostsBlock = code.match(/function renderPosts.*?}\s*}/s);
console.log(getPostsBlock ? getPostsBlock[0] : "Not found in renderPosts");

with open('js/app/feed_view.js', 'r') as f:
    js = f.read()

target = """        // Setup Favorites Modal Listeners
        const favBtn = document.getElementById('feed-favorites-btn');
        const favModal = document.getElementById('feed-favorites-modal');
        const favCloseBtn = document.getElementById('feed-favorites-close-btn');
        const favViewBtn = document.getElementById('feed-favorites-view-btn');

        if (favBtn) favBtn.addEventListener('click', window.FeedVisitas.openFavoritesModal);
        if (favCloseBtn) favCloseBtn.addEventListener('click', () => favModal.classList.add('hidden'));
        if (favViewBtn) favViewBtn.addEventListener('click', window.FeedVisitas.applyFavoritesFilter);
    }"""

replacement = """        // Setup Favorites Modal Listeners
        const favBtn = document.getElementById('feed-favorites-btn');
        const favModal = document.getElementById('feed-favorites-modal');
        const favCloseBtn = document.getElementById('feed-favorites-close-btn');
        const favViewBtn = document.getElementById('feed-favorites-view-btn');
        const clearFavBtn = document.getElementById('feed-clear-favorites-btn');

        if (favBtn) favBtn.addEventListener('click', window.FeedVisitas.openFavoritesModal);
        if (favCloseBtn) favCloseBtn.addEventListener('click', () => favModal.classList.add('hidden'));
        if (favViewBtn) favViewBtn.addEventListener('click', window.FeedVisitas.applyFavoritesFilter);
        if (clearFavBtn) clearFavBtn.addEventListener('click', window.FeedVisitas.clearFavoritesFilter);
    }"""

if target in js:
    js = js.replace(target, replacement)
    with open('js/app/feed_view.js', 'w') as f:
        f.write(js)
    print("Event listener patched successfully.")
else:
    print("Target string not found in JS file.")

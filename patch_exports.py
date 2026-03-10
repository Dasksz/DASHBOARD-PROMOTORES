with open('js/app/feed_view.js', 'r') as f:
    js = f.read()

target = """    window.FeedVisitas = {
        init: init,
        loadFeed: loadFeed,
        toggleFavorite: toggleFavorite,
        openFavoritesModal: openFavoritesModal,
        applyFavoritesFilter: applyFavoritesFilter,
        clientCache: {}
    };"""

replacement = """    window.FeedVisitas = {
        init: init,
        loadFeed: loadFeed,
        toggleFavorite: toggleFavorite,
        openFavoritesModal: openFavoritesModal,
        applyFavoritesFilter: applyFavoritesFilter,
        clearFavoritesFilter: clearFavoritesFilter,
        clientCache: {}
    };"""

if target in js:
    js = js.replace(target, replacement)
    with open('js/app/feed_view.js', 'w') as f:
        f.write(js)
    print("Exports patched successfully.")
else:
    print("Target string not found for exports.")

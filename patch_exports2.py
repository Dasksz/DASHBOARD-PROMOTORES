with open('js/app/feed_view.js', 'r') as f:
    js = f.read()

target = """    return {
        openFavoritesModal,
        applyFavoritesFilter,
        toggleFavorite,"""

replacement = """    return {
        openFavoritesModal,
        applyFavoritesFilter,
        clearFavoritesFilter,
        toggleFavorite,"""

if target in js:
    js = js.replace(target, replacement)
    with open('js/app/feed_view.js', 'w') as f:
        f.write(js)
    print("Exports patched successfully.")
else:
    print("Target string not found.")

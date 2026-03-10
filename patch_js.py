with open('js/app/feed_view.js', 'r') as f:
    js = f.read()

# 1. Show the "Limpar Filtro" button when applyFavoritesFilter is called
apply_func = """
    function applyFavoritesFilter() {
        showOnlyFavorites = true;
        document.getElementById('feed-favorites-modal').classList.add('hidden');

        // Remove filters that might be blocking favorites from other promoters
        const isManager = true; // Always allow viewing favorites regardless of role

        loadFeed(true);
    }
"""

apply_func_replacement = """
    function applyFavoritesFilter() {
        showOnlyFavorites = true;
        document.getElementById('feed-favorites-modal').classList.add('hidden');

        document.getElementById('feed-clear-favorites-btn').classList.remove('hidden');
        document.getElementById('feed-favorites-btn').classList.add('hidden');

        // Remove filters that might be blocking favorites from other promoters
        const isManager = true; // Always allow viewing favorites regardless of role

        loadFeed(true);
    }

    function clearFavoritesFilter() {
        showOnlyFavorites = false;

        document.getElementById('feed-clear-favorites-btn').classList.add('hidden');
        document.getElementById('feed-favorites-btn').classList.remove('hidden');

        loadFeed(true);
    }
"""
js = js.replace(apply_func, apply_func_replacement)

# 2. Add event listener for clear filter button
init_func_search = "const viewFeedBtn = document.getElementById('view-favorites-feed-btn');"
init_func_replacement = """const viewFeedBtn = document.getElementById('view-favorites-feed-btn');
        const clearBtn = document.getElementById('feed-clear-favorites-btn');
        if (clearBtn) clearBtn.addEventListener('click', clearFavoritesFilter);"""
js = js.replace(init_func_search, init_func_replacement)


# 3. Modify loadFeed heading to reflect normal view if showOnlyFavorites is false
load_feed_search = "const titleText = showOnlyFavorites ? 'Pesquisas Favoritas' : 'Últimas Visitas';"
load_feed_replacement = "const titleText = showOnlyFavorites ? 'Pesquisas Favoritas' : 'Últimas Visitas';" # keeping this, just making sure the state resets correctly.
js = js.replace(load_feed_search, load_feed_replacement)

with open('js/app/feed_view.js', 'w') as f:
    f.write(js)

print("JS Patched.")

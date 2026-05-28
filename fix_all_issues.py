import re

with open('js/app/app.js', 'r') as f:
    content = f.read()

# 1. getHierarchyFilteredClients: short circuit if no filters
target = """            if (!state) return sourceClients;

            const { coords, cocoords, promotors } = state;"""

replacement = """            if (!state) return sourceClients;

            // ⚡ Bolt Optimization: If state is empty and user is admin, return source directly to avoid full iteration and O(N) proxy hydration
            const hasAnyStateFilter = state.coords.size > 0 || state.cocoords.size > 0 || state.promotors.size > 0;
            const hasAnyContextFilter = userHierarchyContext.role === 'coord' || userHierarchyContext.role === 'cocoord' || userHierarchyContext.role === 'promotor';
            if (!hasAnyStateFilter && !hasAnyContextFilter) {
                return sourceClients;
            }

            const { coords, cocoords, promotors } = state;"""

content = content.replace(target, replacement)

# 2. .filter on columnar arrays needs to be replaced with a native loop that doesn't eagerly create Proxies, OR proxy hydration needs to be minimized.
# But `ColumnarDataset.prototype.filter` ALREADY eagerly iterates and calls `this.get(i)`.
# Let's fix utils.js ColumnarDataset to NOT eagerly hydrate if we can, or just replace `.filter` calls.

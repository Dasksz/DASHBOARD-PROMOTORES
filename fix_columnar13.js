const fs = require('fs');
let app = fs.readFileSync('js/app/app.js', 'utf8');

// I need to see what `hierarchyState['main']` looks like right after load.
// If it is initialized, `!state` is false, and it loops over 300,000 items, calling .get(i) for each, even if NO filters are active.

const patch = app.replace(/if \(!state\) return sourceClients;/, `if (!state) return sourceClients;

            // ⚡ Bolt Optimization: If state is empty and user is admin, return source directly to avoid full iteration and O(N) proxy hydration
            const hasAnyStateFilter = state.coords.size > 0 || state.cocoords.size > 0 || state.promotors.size > 0;
            const hasAnyContextFilter = userHierarchyContext.role === 'coord' || userHierarchyContext.role === 'cocoord' || userHierarchyContext.role === 'promotor';
            if (!hasAnyStateFilter && !hasAnyContextFilter) {
                return sourceClients;
            }`);

fs.writeFileSync('js/app/app_patched.js', patch);
console.log("Patched size:", patch.length);

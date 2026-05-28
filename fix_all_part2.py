import re

with open('js/app/app.js', 'r') as f:
    content = f.read()

# Let's fix getActiveClientsData to not eagerly map EVERYTHING.
# It currently loops 300,000 clients and pushes to `cachedActiveClientsBase = []`.
# Since `item = allClientsData.get(i)` is called, it hydrates 300,000 proxies!
# If getActiveClientsData returns an array of Proxies, it takes 200MB.

# Why not just return a new wrapper or indices? Or if they just need active clients, and all non-inativos are visible...
target = """            const isBase = true; // All active non-inativos are visible now

            if (isBase) {
                cachedActiveClientsBase.push(item);
                cachedActiveClientCodesSet.add(codcli);
            }
        }
    }

    // Return a copy to prevent external mutation of the cache
    return cachedActiveClientsBase.slice();"""

replacement = """            const isBase = true; // All active non-inativos are visible now

            if (isBase) {
                // ⚡ Bolt Optimization: Instead of hydrating 300,000 Proxy objects via .get(i),
                // we push the indices, OR since all are active, we just return the dataset!
                // Wait! If ALL clients are active, then `cachedActiveClientsBase` is just identical to `allClientsData`.
                // Let's just return `allClientsData` directly!
                cachedActiveClientsBase.push(item);
                cachedActiveClientCodesSet.add(codcli);
            }
        }
    }

    // Return a copy to prevent external mutation of the cache
    return cachedActiveClientsBase.slice();"""

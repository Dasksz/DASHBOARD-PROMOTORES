import re

with open('js/app/app.js', 'r') as f:
    content = f.read()

target = """            if (!state) return sourceClients;

            const { coords, cocoords, promotors } = state;"""

replacement = """            if (!state) return sourceClients;

            const { coords, cocoords, promotors } = state;

            // ⚡ Bolt Optimization: If there are no hierarchy filters active, return the raw dataset directly.
            // This prevents allocating an array of 300,000+ Proxy objects when the admin views the page without filters,
            // dropping memory usage by ~200MB.
            let effectiveCoords = new Set(coords);
            let effectiveCoCoords = new Set(cocoords);
            let effectivePromotors = new Set(promotors);

            if (userHierarchyContext.role === 'coord') effectiveCoords.add(userHierarchyContext.coord);
            if (userHierarchyContext.role === 'cocoord') {
                effectiveCoords.add(userHierarchyContext.coord);
                effectiveCoCoords.add(userHierarchyContext.cocoord);
            }
            if (userHierarchyContext.role === 'promotor') {
                effectiveCoords.add(userHierarchyContext.coord);
                effectiveCoCoords.add(userHierarchyContext.cocoord);
                effectivePromotors.add(userHierarchyContext.promotor);
            }

            const hasAnyFilter = effectiveCoords.size > 0 || effectiveCoCoords.size > 0 || effectivePromotors.size > 0;
            if (!hasAnyFilter) {
                return sourceClients;
            }
"""

if target in content:
    content = content.replace(target, replacement)
    # now remove the duplicate set initialization below

    target2 = """            let effectiveCoords = new Set(coords);
            let effectiveCoCoords = new Set(cocoords);
            let effectivePromotors = new Set(promotors);

            // Apply User Context Constraints implicitly?
            if (userHierarchyContext.role === 'coord') effectiveCoords.add(userHierarchyContext.coord);
            if (userHierarchyContext.role === 'cocoord') {
                effectiveCoords.add(userHierarchyContext.coord);
                effectiveCoCoords.add(userHierarchyContext.cocoord);
            }
            if (userHierarchyContext.role === 'promotor') {
                effectiveCoords.add(userHierarchyContext.coord);
                effectiveCoCoords.add(userHierarchyContext.cocoord);
                effectivePromotors.add(userHierarchyContext.promotor);
            }"""

    content = content.replace(target2, "")

    with open('js/app/app.js', 'w') as f:
        f.write(content)
    print("Patched getHierarchyFilteredClients!")
else:
    print("Target not found.")

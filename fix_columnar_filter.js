const fs = require('fs');

function checkHierarchyCalls() {
    let content = fs.readFileSync('js/app/app.js', 'utf8');

    // Check if hierarchy result is heavily modified
    // getHierarchyFilteredClients returns an Array.
    // Wait... if getHierarchyFilteredClients returns `sourceClients` (a ColumnarDataset)
    // when there are NO filters, then it returns a ColumnarDataset!
    // And ALL the downstream code MUST already support handling a ColumnarDataset because before today,
    // `state` was usually populated, but if it wasn't, wait...
    // Let's check `getHierarchyFilteredClients`.
    // It says: `if (!state) return sourceClients;`
    // So YES! Downstream code is ALREADY perfectly capable of receiving a ColumnarDataset instead of an Array of Proxies!
}

checkHierarchyCalls();

import re

with open('js/app/app.js', 'r') as f:
    content = f.read()

# Replace getHierarchyFilteredClients to NOT instantiate full proxy immediately if we don't need it.
# Wait, it *does* need it because `result.push(client)` expects the object/proxy to be in the result array!
# And ALL views consume this result array and iterate over it.
# If `getHierarchyFilteredClients` returns `300,000` proxies, then memory shoots up by 200MB!

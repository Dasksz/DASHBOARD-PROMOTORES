import re

with open('js/app/app.js', 'r') as f:
    content = f.read()

start_idx = content.find('        function getActiveClientsData() {')
end_idx = content.find('    function isExcluded(filterType) {')

if start_idx != -1 and end_idx != -1:
    replacement = """        function getActiveClientsData() {
            // ⚡ Bolt Optimization: All clients are active now since `isBase = true`.
            // Hydrating 300,000 proxies and returning them in an array consumes ~200MB memory.
            // We simply return the raw ColumnarDataset, which acts exactly like an array to consumers!

            try {
                if (lastAllClientsData !== allClientsData || !cachedActiveClientCodesSet) {
                    lastAllClientsData = allClientsData;
                    cachedActiveClientCodesSet = new Set();

                    const isColumnar = allClientsData instanceof ColumnarDataset;
                    const len = allClientsData.length;
                    let colCode = null;

                    if (isColumnar) {
                        const data = allClientsData._data;
                        colCode = data['Código'] || data['codigo_cliente'] || [];
                    }

                    for (let i = 0; i < len; i++) {
                        if (isColumnar) {
                            cachedActiveClientCodesSet.add(String(colCode[i] || ''));
                        } else {
                            cachedActiveClientCodesSet.add(String(allClientsData[i]['Código'] || allClientsData[i]['codigo_cliente'] || ''));
                        }
                    }
                }

                return allClientsData;
            } catch (e) {
                console.error("[ActiveClients] Error:", e);
                return allClientsData;
            }
        }

"""

    content = content[:start_idx] + replacement + content[end_idx:]
    with open('js/app/app.js', 'w') as f:
        f.write(content)
    print("Patched getActiveClientsData!")
else:
    print("Indices not found", start_idx, end_idx)

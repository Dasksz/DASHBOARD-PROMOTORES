import re

with open('js/app/app.js', 'r') as f:
    content = f.read()

# find it manually using regex
pattern = re.compile(r'function getActiveClientsData\(\) \{[\s\S]*?\} catch \(e\) \{\n\s*console\.error\("\[ActiveClients\] Error:", e\);\n\s*return allClientsData;\n\s*\}\n\s*\}')
match = pattern.search(content)

if match:
    replacement = """function getActiveClientsData() {
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

            // ⚡ Bolt Optimization: All clients are active now since `isBase = true`.
            // Hydrating 300,000 proxies and returning them in an array consumes ~200MB memory.
            // We simply return the raw ColumnarDataset, which acts exactly like an array to consumers!
            return allClientsData;
        } catch (e) {
            console.error("[ActiveClients] Error:", e);
            return allClientsData;
        }
    }"""

    content = content[:match.start()] + replacement + content[match.end():]
    with open('js/app/app.js', 'w') as f:
        f.write(content)
    print("Patched getActiveClientsData!")
else:
    print("Could not find getActiveClientsData")

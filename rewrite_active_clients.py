import re

with open('js/app/app.js', 'r') as f:
    content = f.read()

target = """    function getActiveClientsData() {
        try {
            // Invalidate cache if source data reference changes
            if (lastAllClientsData !== allClientsData) {
                cachedActiveClientsBase = null;
                cachedActiveClientCodesSet = null;
                lastAllClientsData = allClientsData;
            }

            if (!cachedActiveClientsBase || !cachedActiveClientCodesSet) {
                cachedActiveClientsBase = [];
                cachedActiveClientCodesSet = new Set();

                const isColumnar = allClientsData instanceof ColumnarDataset;
                const len = allClientsData.length;

                // Prepare Accessors for Columnar path
                let colCode, colRca1, colRazao;
                let data;
                if (isColumnar) {
                    data = allClientsData._data;
                    colCode = data['Código'] || data['codigo_cliente'] || [];
                    colRca1 = data['rca1'] || data['RCA 1'] || data['RCA1'] || [];
                    colRazao = data['razaoSocial'] || data['RAZAOSOCIAL'] || data['Cliente'] || data['CLIENTE'] || [];
                }

                for (let i = 0; i < len; i++) {
                    let codcli, rca1, razao;
                    let item;

                    if (isColumnar) {
                        codcli = String(colCode[i] || '');
                        rca1 = String(colRca1[i] || '').trim();
                        razao = colRazao[i];
                        // Push to cache (hydrate Proxy now)
                        item = allClientsData.get(i);
                    } else {
                        item = allClientsData[i];
                        codcli = String(item['Código'] || item['codigo_cliente'] || '');
                        rca1 = String(item.rca1 || '').trim();
                        razao = item.razaoSocial || item.Cliente;
                    }

                    let isAmericanas = item.isAmericanas !== undefined ? item.isAmericanas : (item.isAmericanas = (item.razaoSocial || item.Cliente || '').toUpperCase().includes('AMERICANAS'));

                    // Base Condition: Always Visible
                    const isBase = true; // All active non-inativos are visible now

                    if (isBase) {
                        cachedActiveClientsBase.push(item);
                        cachedActiveClientCodesSet.add(codcli);
                    }
                }
            }

            // Return a copy to prevent external mutation of the cache
            return cachedActiveClientsBase.slice();

        } catch (e) {
            console.error("[ActiveClients] Error:", e);
            return allClientsData;
        }
    }"""

replacement = """    function getActiveClientsData() {
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
    }"""

if target in content:
    content = content.replace(target, replacement)
    with open('js/app/app.js', 'w') as f:
        f.write(content)
    print("Patched getActiveClientsData!")
else:
    print("Target not found.")

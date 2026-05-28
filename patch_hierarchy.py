import re

with open('js/app/app.js', 'r') as f:
    content = f.read()

# We want to change the loop in getHierarchyFilteredClients to NOT eagerly call .get(i)
# We can read 'Código' directly from the columnar array first!

old_loop = """            for(let i=0; i<len; i++) {
                const client = isColumnar ? sourceClients.get(i) : sourceClients[i];
                const codCli = normalizeKey(client['Código'] || client['codigo_cliente']);"""

new_loop = """            // ⚡ Bolt Optimization: Pre-extract columnar arrays to avoid Proxy creation in loop
            const colCodigo = isColumnar ? (sourceClients._data['Código'] || sourceClients._data['codigo_cliente'] || sourceClients._data['CODIGO_CLIENTE']) : null;

            for(let i=0; i<len; i++) {
                const rawCod = isColumnar ? colCodigo[i] : (sourceClients[i]['Código'] || sourceClients[i]['codigo_cliente']);
                const codCli = normalizeKey(rawCod);
                const node = optimizedData.clientHierarchyMap.get(codCli);

                if (!node) {
                    missingNodeCount++;
                    if (userHierarchyContext.role === 'adm') {
                        const hasFilters = effectiveCoords.size > 0 || effectiveCoCoords.size > 0 || effectivePromotors.size > 0;
                        if (!hasFilters) {
                            result.push(isColumnar ? sourceClients.get(i) : sourceClients[i]);
                        }
                    } else {
                        result.push(isColumnar ? sourceClients.get(i) : sourceClients[i]);
                    }
                    continue;
                }

                if (effectiveCoords.size > 0 && !effectiveCoords.has(node.coord.code)) continue;
                if (effectiveCoCoords.size > 0 && !effectiveCoCoords.has(node.cocoord.code)) continue;
                if (effectivePromotors.size > 0 && !effectivePromotors.has(node.promotor.code)) continue;

                result.push(isColumnar ? sourceClients.get(i) : sourceClients[i]);"""

# actually, if we do this, it only creates proxies for MATCHING rows!
# But wait, missing nodes with NO FILTERS (admins) will STILL create all 300,000 proxies!
# If the goal is to not instantiate proxies until we absolutely need them... well, `result` is consumed by the rest of the app which iterates it.
# BUT wait! If NO filters are applied, why doesn't it just return the original array/dataset?
# Wait!

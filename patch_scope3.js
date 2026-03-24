const fs = require('fs');
let code = fs.readFileSync('/app/js/app/app_part3.js', 'utf8');

const searchStr = `                // --- NEW METAS CHART LOGIC ---
                // We need to calculate Realized vs Meta for Faturamento, Volume, Positivation, Mix Salty, Mix Foods
                // based on the visible goalClients`;

const replaceStr = `                // --- NEW METAS CHART LOGIC ---
                // Calculate goalClients based on the current filters
                let goalClients = getHierarchyFilteredClients('main', allClientsData);
                if (typeof adminViewMode !== 'undefined' && adminViewMode === 'seller' && selectedSupervisors.size > 0) {
                    goalClients = goalClients.filter(c => {
                        const rca = String(c.rca1 || '').trim();
                        const details = sellerDetailsMap.get(rca);
                        return details && selectedSupervisors.has(details.supervisor);
                    });
                }
                if (selectedVendedores.size > 0) {
                    goalClients = goalClients.filter(c => selectedVendedores.has(String(c.rca1 || '').trim()));
                }
                if (clientCodesInRede) {
                     goalClients = goalClients.filter(c => clientCodesInRede.has(c['Código']));
                }
                if (codcli) {
                     const searchKey = normalizeKey(codcli);
                     goalClients = goalClients.filter(c => normalizeKey(String(c['Código'] || c['codigo_cliente'])) === searchKey);
                }

                const activeGoalKeys = new Set();
                const mapSupplierToKey = (s) => {
                    const sup = String(s).toUpperCase();
                    if (sup === 'PEPSICO') return ['PEPSICO_ALL'];
                    if (sup === 'ELMA CHIPS' || sup === 'ELMA') return ['ELMA_ALL'];
                    if (sup === 'FOODS') return ['FOODS_ALL'];
                    if (sup === 'EXTRUSADOS') return [window.SUPPLIER_CODES.ELMA[0]];
                    if (sup === 'NÃO EXTRUSADOS' || sup === 'NAO EXTRUSADOS') return [window.SUPPLIER_CODES.ELMA[1]];
                    if (sup === 'TORCIDA') return [window.SUPPLIER_CODES.ELMA[2]];
                    if (sup === 'TODDYNHO') return [window.SUPPLIER_CODES.VIRTUAL.TODDYNHO];
                    if (sup === 'TODDY') return [window.SUPPLIER_CODES.VIRTUAL.TODDY];
                    if (sup === 'QUAKER' || sup === 'KEROCOCO' || sup.includes('QUAKER')) return [window.SUPPLIER_CODES.VIRTUAL.QUAKER_KEROCOCO];
                    if (window.globalGoalsMetrics && window.globalGoalsMetrics[sup]) return [sup];
                    if (window.SUPPLIER_CODES.ALL_GOALS.includes(sup)) return [sup];
                    if (sup === window.SUPPLIER_CODES.FOODS[0]) return ['FOODS_ALL'];
                    return [];
                };
                if (selectedMainSuppliers && selectedMainSuppliers.length > 0) {
                    selectedMainSuppliers.forEach(s => mapSupplierToKey(s).forEach(k => activeGoalKeys.add(k)));
                } else if (currentFornecedor) {
                    mapSupplierToKey(currentFornecedor).forEach(k => activeGoalKeys.add(k));
                }
                if (activeGoalKeys.size === 0) activeGoalKeys.add('PEPSICO_ALL');

                // We need to calculate Realized vs Meta for Faturamento, Volume, Positivation, Mix Salty, Mix Foods
                // based on the visible goalClients`;

code = code.replace(searchStr, replaceStr);
fs.writeFileSync('/app/js/app/app_part3.js', code, 'utf8');
console.log("Patched app_part3.js");

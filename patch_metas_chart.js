const fs = require('fs');
let code = fs.readFileSync('/app/js/app/app.js', 'utf8');

// The logic needs to be placed inside updateDashboardView, right after renderCategoryRadarChart(radarData);

const insertionPoint = `                renderCategoryRadarChart(radarData);`;

const newChartLogic = `                renderCategoryRadarChart(radarData);

                // --- NEW METAS CHART LOGIC ---
                // We need to calculate Realized vs Meta for Faturamento, Volume, Positivation, Mix Salty, Mix Foods
                // based on the visible goalClients

                const metasRadarData = [];
                const mColors = [
                    0x3b82f6, // Faturamento - Blue
                    0x10b981, // Volume - Emerald
                    0xf97316, // Positivação - Orange
                    0xef4444, // Mix Salty - Red
                    0xeab308  // Mix Foods - Yellow
                ];

                let fatRealized = 0, fatGoal = 0;
                let volRealized = 0, volGoal = 0;
                let posRealized = 0, posGoal = 0;
                let mixSaltyRealized = 0, mixSaltyGoal = 0;
                let mixFoodsRealized = 0, mixFoodsGoal = 0;

                // 1. Accumulate Goals from window.globalClientGoals based on goalClients
                if (window.globalClientGoals && goalClients) {
                    goalClients.forEach(c => {
                        const codCli = normalizeKey(String(c['Código'] || c['codigo_cliente']));
                        const cGoals = window.globalClientGoals.get(codCli);
                        if (cGoals) {
                            // Sum up Faturamento & Volume based on activeGoalKeys
                            activeGoalKeys.forEach(key => {
                                if (cGoals.has(key)) {
                                    fatGoal += (cGoals.get(key).fat || 0);
                                    volGoal += (cGoals.get(key).vol || 0);
                                    posGoal += (cGoals.get(key).pos || 0);
                                }
                            });

                            // Mix Goals (always aggregate these specific keys if they apply to the filter)
                            if (activeGoalKeys.has('PEPSICO_ALL') || activeGoalKeys.has('ELMA_ALL')) {
                                if (cGoals.has('mix_salty')) {
                                    mixSaltyGoal += (cGoals.get('mix_salty').mix || 0);
                                }
                            }
                            if (activeGoalKeys.has('PEPSICO_ALL') || activeGoalKeys.has('FOODS_ALL')) {
                                if (cGoals.has('mix_foods')) {
                                    mixFoodsGoal += (cGoals.get('mix_foods').mix || 0);
                                }
                            }
                        }
                    });
                }

                // Default POS Goal is 100% of visible clients if no specific goal is set
                // But only for the specific active filter (if Pepsico, base is everyone; if Elma, base is active Elma clients)
                // We use goalClients.length if posGoal is 0 or missing, but wait, the logic for Positivacao goal is better left to explicit goals.
                // If posGoal is 0, we'll try to fallback to the natural client count.
                if (posGoal === 0 && goalClients && goalClients.length > 0) {
                     // For 'PEPSICO_ALL' or similar, we might just assume 100% of goalClients is the target
                     posGoal = goalClients.length;
                }

                // 2. Accumulate Realized values
                const pepsicoCodfors = new Set([window.SUPPLIER_CODES.ELMA[0], window.SUPPLIER_CODES.ELMA[1], window.SUPPLIER_CODES.ELMA[2]]);
                const saltyCategories = ['CHEETOS', 'DORITOS', 'FANDANGOS', 'RUFFLES', 'TORCIDA'];
                const foodsCategories = ['TODDYNHO', 'TODDY ', 'QUAKER', 'KEROCOCO'];
                const norm = (s) => s ? s.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toUpperCase() : '';

                const dashboardClientsMap = new Map();

                if (filteredSalesData) {
                    for(let i=0; i<filteredSalesData.length; i++) {
                        const s = (filteredSalesData instanceof ColumnarDataset) ? filteredSalesData.get(i) : filteredSalesData[i];

                        // Faturamento and Volume based on active filters (which are inherently applied to filteredSalesData)
                        fatRealized += (Number(s.VLVENDA) || 0);
                        volRealized += (Number(s.TOTPESOLIQ) || 0);

                        // Track by Client for Positivation and Mix
                        const codCli = normalizeKey(s.CODCLI);
                        if (!dashboardClientsMap.has(codCli)) {
                             dashboardClientsMap.set(codCli, new Map());
                        }
                        const cMap = dashboardClientsMap.get(codCli);

                        const produto = String(s.PRODUTO);
                        if (!cMap.has(produto)) {
                            const pObj = window.resolveDim('produtos', produto);
                            const pDesc = (typeof pObj === 'object' && pObj.descricao) ? pObj.descricao : (s.DESCRICAO || '');
                            cMap.set(produto, { val: 0, desc: pDesc, codfor: String(s.CODFOR) });
                        }
                        cMap.get(produto).val += (Number(s.VLVENDA) || 0);
                    }
                }

                posRealized = dashboardClientsMap.size;

                dashboardClientsMap.forEach((prods, cli) => {
                    const boughtCatsSalty = new Set();
                    const boughtCatsFoods = new Set();

                    prods.forEach(pData => {
                        if (pData.val >= 1) { // Same threshold used in Comparison view
                            const desc = norm(pData.desc);
                            saltyCategories.forEach(cat => { if (desc.includes(cat)) boughtCatsSalty.add(cat); });
                            foodsCategories.forEach(cat => { if (desc.includes(cat)) boughtCatsFoods.add(cat); });
                        }
                    });

                    if (boughtCatsSalty.size >= saltyCategories.length) mixSaltyRealized++;
                    if (boughtCatsFoods.size >= foodsCategories.length) mixFoodsRealized++;
                });

                // 3. Build Radar Data
                const addMetaToRadar = (label, realized, goal, idx) => {
                     let pct = 0;
                     if (goal > 0) {
                         pct = (realized / goal) * 100;
                     } else if (realized > 0) {
                         pct = 100;
                     }

                     metasRadarData.push({
                         category: label,
                         value: pct,
                         full: 100,
                         columnSettings: { fill: window.am5.color(mColors[idx]) },
                         realizedLabel: label === 'Positivação' || label.includes('Mix') ? Math.floor(realized).toString() : 'R$ ' + realized.toLocaleString('pt-BR', {minimumFractionDigits: 2}),
                         goalLabel: label === 'Positivação' || label.includes('Mix') ? Math.floor(goal).toString() : 'R$ ' + goal.toLocaleString('pt-BR', {minimumFractionDigits: 2})
                     });
                };

                let mIdx = 0;
                addMetaToRadar('Faturamento', fatRealized, fatGoal, mIdx++);
                addMetaToRadar('Volume (Ton)', volRealized / 1000, volGoal / 1000, mIdx++);
                addMetaToRadar('Positivação', posRealized, posGoal, mIdx++);

                // Render Mix metrics conditionally depending on the active filter
                if (activeGoalKeys.has('PEPSICO_ALL') || activeGoalKeys.has('ELMA_ALL')) {
                    addMetaToRadar('Mix Salty', mixSaltyRealized, mixSaltyGoal, mIdx++);
                }
                if (activeGoalKeys.has('PEPSICO_ALL') || activeGoalKeys.has('FOODS_ALL')) {
                    addMetaToRadar('Mix Foods', mixFoodsRealized, mixFoodsGoal, mIdx++);
                }

                renderMetasRadarChart(metasRadarData);`;

if (code.includes('renderCategoryRadarChart(radarData);')) {
    code = code.replace(insertionPoint, newChartLogic);
    fs.writeFileSync('/app/js/app/app.js', code, 'utf8');
    console.log("Chart logic injected into app.js.");
} else {
    console.log("Insertion point not found.");
}

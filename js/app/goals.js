window.App = window.App || {};
window.App.Goals = {
    init: function() {
        // Bind Buttons
        const saveBtn = document.getElementById('save-goals-btn');
        if (saveBtn) saveBtn.addEventListener('click', () => this.saveGoalsToSupabase());

        const clearBtn = document.getElementById('clear-goals-btn');
        if (clearBtn) clearBtn.addEventListener('click', () => this.clearGoalsFromSupabase());

        // Initial Calculation if needed, or wait for renderView
    },

    identifyQuarterMonths: function() {
        const history = window.AppState.allHistoryData;
        const months = new Set();
        const len = history.length;
        const isColumnar = history instanceof window.Utils.ColumnarDataset;

        for (let i = 0; i < len; i++) {
            const s = isColumnar ? history.get(i) : history[i];
            const d = window.Utils.parseDate(s.DTPED);
            if(d) months.add(`${d.getUTCFullYear()}-${d.getUTCMonth()}`);
        }

        const sorted = Array.from(months).sort((a, b) => {
            const [y1, m1] = a.split('-').map(Number);
            const [y2, m2] = b.split('-').map(Number);
            return (y1 * 12 + m1) - (y2 * 12 + m2);
        });

        const last3 = sorted.slice(-3);
        const monthNames = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

        window.AppState.quarterMonths = last3.map(k => {
            const [y, m] = k.split('-');
            return { key: k, label: monthNames[parseInt(m)] };
        });
    },

    calculateGoalsMetrics: function() {
        if (window.AppState.quarterMonths.length === 0) this.identifyQuarterMonths();

        const QUARTERLY_DIVISOR = 3;
        const metrics = {};
        const targets = window.Rules.GOALS_TARGETS; // Use from Rules

        // Initialize Metrics Structure based on Rules
        const keys = ['707', '708', '752', '1119_TODDYNHO', '1119_TODDY', '1119_QUAKER_KEROCOCO', 'ELMA_ALL', 'FOODS_ALL', 'PEPSICO_ALL'];
        keys.forEach(k => {
            metrics[k] = {
                fat: 0, vol: 0, prevFat: 0, prevVol: 0,
                prevClientsSet: new Set(),
                monthlyClientsSets: new Map()
            };
        });

        window.AppState.globalGoalsMetrics = metrics;
        window.AppState.globalClientGoals.clear();

        const currentDate = window.AppState.lastSaleDate || new Date(); // Fallback if null
        const prevMonthDate = new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth() - 1, 1));
        const prevMonthIndex = prevMonthDate.getUTCMonth();
        const prevMonthYear = prevMonthDate.getUTCFullYear();

        // Filter Active Clients
        const activeClients = window.App.Filters.getActiveClientsData ? window.App.Filters.getActiveClientsData() : window.AppState.allClientsData;

        const validClients = [];
        const len = window.AppState.allClientsData.length;
        const isColumnar = window.AppState.allClientsData instanceof window.Utils.ColumnarDataset;

        for (let i = 0; i < len; i++) {
            const c = isColumnar ? window.AppState.allClientsData.get(i) : window.AppState.allClientsData[i];
            const rca1 = String(c.rca1 || '').trim();
            const isAmericanas = (c.razaoSocial || '').toUpperCase().includes('AMERICANAS');
            if (isAmericanas || (rca1 !== '53' && rca1 !== '')) {
                validClients.push(c);
            }
        }

        const historyIndex = window.AppState.optimizedData.indices.history.byClient;

        // Safety check for historyIndex
        if (!historyIndex) return;

        validClients.forEach(client => {
            const codCli = window.Utils.normalizeKey(client['Código'] || client['codigo_cliente']);
            const clientHistoryIds = historyIndex.get(codCli);
            const clientTotals = {};

            if (clientHistoryIds) {
                clientHistoryIds.forEach(idx => {
                    // Direct access
                    const sale = isColumnar ? window.AppState.allHistoryData.get(idx) : window.AppState.allHistoryData[idx];

                    // Exclude logic
                    const codUsur = String(sale.CODUSUR || '').trim();
                    if (codCli === '9569' && (codUsur === '53' || codUsur === '053')) return;

                    let key = null;
                    const codFor = String(sale.CODFOR);
                    if (codFor === '707') key = '707';
                    else if (codFor === '708') key = '708';
                    else if (codFor === '752') key = '752';
                    else if (codFor === '1119') {
                        const desc = (sale.DESCRICAO || '').toUpperCase();
                        if (desc.includes('TODDYNHO')) key = '1119_TODDYNHO';
                        else if (desc.includes('TODDY')) key = '1119_TODDY';
                        else if (desc.includes('QUAKER') || desc.includes('KEROCOCO')) key = '1119_QUAKER_KEROCOCO';
                    }

                    if (key && metrics[key]) {
                        const d = window.Utils.parseDate(sale.DTPED);
                        // Check valid date
                        if(!d) return;

                        const isPrevMonth = d.getUTCMonth() === prevMonthIndex && d.getUTCFullYear() === prevMonthYear;
                        const type = String(sale.TIPOVENDA);

                        if (type === '1' || type === '9') {
                            const val = Number(sale.VLVENDA) || 0;
                            const vol = Number(sale.TOTPESOLIQ) || 0;

                            metrics[key].fat += val;
                            metrics[key].vol += vol;

                            if (isPrevMonth) {
                                metrics[key].prevFat += val;
                                metrics[key].prevVol += vol;

                                if (!window.AppState.globalClientGoals.has(codCli)) window.AppState.globalClientGoals.set(codCli, new Map());
                                const cGoals = window.AppState.globalClientGoals.get(codCli);
                                if (!cGoals.has(key)) cGoals.set(key, { fat: 0, vol: 0 });
                                const g = cGoals.get(key);
                                g.fat += val;
                                g.vol += vol;
                            }

                            if (d) {
                                if (!clientTotals[key]) clientTotals[key] = { prevFat: 0, monthlyFat: new Map() };
                                if (isPrevMonth) clientTotals[key].prevFat += val;
                                const mKey = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
                                const cur = clientTotals[key].monthlyFat.get(mKey) || 0;
                                clientTotals[key].monthlyFat.set(mKey, cur + val);
                            }
                        }
                    }
                });
            }

            for (const key in clientTotals) {
                const t = clientTotals[key];
                if (t.prevFat >= 1) metrics[key].prevClientsSet.add(codCli);
                t.monthlyFat.forEach((val, mKey) => {
                    if (val >= 1) {
                        if (!metrics[key].monthlyClientsSets.has(mKey)) metrics[key].monthlyClientsSets.set(mKey, new Set());
                        metrics[key].monthlyClientsSets.get(mKey).add(codCli);
                    }
                });
            }
        });

        // Aggregation
        const aggregate = (targetKey, sourceKeys) => {
            const target = metrics[targetKey];
            sourceKeys.forEach(key => {
                const source = metrics[key];
                target.fat += source.fat;
                target.vol += source.vol;
                target.prevFat += source.prevFat;
                target.prevVol += source.prevVol;
                source.prevClientsSet.forEach(c => target.prevClientsSet.add(c));
                source.monthlyClientsSets.forEach((set, mKey) => {
                    if (!target.monthlyClientsSets.has(mKey)) target.monthlyClientsSets.set(mKey, new Set());
                    set.forEach(c => target.monthlyClientsSets.get(mKey).add(c));
                });
            });
        };

        aggregate('ELMA_ALL', ['707', '708', '752']);
        aggregate('FOODS_ALL', ['1119_TODDYNHO', '1119_TODDY', '1119_QUAKER_KEROCOCO']);
        aggregate('PEPSICO_ALL', ['707', '708', '752', '1119_TODDYNHO', '1119_TODDY', '1119_QUAKER_KEROCOCO']);

        for (const key in metrics) {
            const m = metrics[key];
            m.avgFat = m.fat / QUARTERLY_DIVISOR;
            m.avgVol = m.vol / QUARTERLY_DIVISOR;
            m.prevClients = m.prevClientsSet.size;
            let sumClients = 0;
            m.monthlyClientsSets.forEach(set => sumClients += set.size);
            m.avgClients = sumClients / QUARTERLY_DIVISOR;
        }
    },

    saveGoalsToSupabase: async function() {
        if (window.AppState.userHierarchyContext.role !== 'adm') {
            window.Utils.showToast('warning', 'Apenas ADM pode salvar metas.');
            return;
        }

        const btn = document.getElementById('save-goals-btn');
        const oldText = btn.innerHTML;
        btn.disabled = true; btn.innerHTML = 'Salvando...';

        try {
            const monthKey = new Date().toISOString().slice(0, 7);
            const goalsObj = {};
            window.AppState.globalClientGoals.forEach((val, key) => {
                goalsObj[key] = Object.fromEntries(val);
            });

            const payload = {
                month_key: monthKey,
                supplier: 'ALL',
                brand: 'GENERAL',
                goals_data: {
                    clients: goalsObj,
                    targets: window.Rules.GOALS_TARGETS,
                },
                updated_at: new Date().toISOString()
            };

            const { error } = await window.supabaseClient.from('goals_distribution').upsert(payload, { onConflict: 'month_key,supplier,brand' });
            if (error) throw error;

            window.Utils.showToast('success', 'Metas salvas!');
        } catch (e) {
            window.Utils.showToast('error', e.message);
        } finally {
            btn.disabled = false; btn.innerHTML = oldText;
        }
    },

    clearGoalsFromSupabase: async function() {
        if (window.AppState.userHierarchyContext.role !== 'adm') return;
        const btn = document.getElementById('clear-goals-btn');
        const oldText = btn.innerHTML;
        btn.disabled = true; btn.innerHTML = 'Limpando...';

        try {
            const monthKey = new Date().toISOString().slice(0, 7);
            const { error } = await window.supabaseClient.from('goals_distribution').delete().match({ month_key: monthKey, supplier: 'ALL', brand: 'GENERAL' });
            if (error) throw error;

            window.AppState.globalClientGoals.clear();
            window.Utils.showToast('success', 'Metas limpas!');
        } catch (e) {
            window.Utils.showToast('error', e.message);
        } finally {
            btn.disabled = false; btn.innerHTML = oldText;
        }
    }
};

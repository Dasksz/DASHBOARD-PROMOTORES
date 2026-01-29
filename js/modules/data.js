import { normalizeKey, parseDate } from './utils.js';
import { SPECIAL_CLIENTS } from './constants.js';

// --- OPTIMIZATION: Lazy Columnar Accessor with Write-Back Support ---
export class ColumnarDataset {
    constructor(columnarData) {
        this.columns = columnarData.columns;
        this._data = columnarData.values; // Renamed to avoid shadowing values() method
        this.length = columnarData.length;
        this._overrides = new Map(); // Stores mutations: Map<index, Object>
    }

    get(index) {
        if (index < 0 || index >= this.length) return undefined;

        const overrides = this._overrides;
        const values = this._data;
        const columns = this.columns;

        // Return a Lazy Proxy that constructs properties only on access
        // and supports write-back for mutations (e.g. seller remapping)
        return new Proxy({}, {
            get(target, prop) {
                if (prop === 'toJSON') return () => "ColumnarRowProxy"; // Debug help

                // 1. Check overrides first (mutations)
                const ov = overrides.get(index);
                if (ov && prop in ov) {
                    return ov[prop];
                }

                // 2. Check columnar data (lazy read)
                if (values && values[prop]) {
                    return values[prop][index];
                }

                return target[prop]; // Fallback (e.g. prototype methods)
            },

            set(target, prop, value) {
                let ov = overrides.get(index);
                if (!ov) {
                    ov = {};
                    overrides.set(index, ov);
                }
                ov[prop] = value;
                return true;
            },

            ownKeys(target) {
                const ov = overrides.get(index);
                if (ov) {
                    const keys = new Set(columns);
                    Object.keys(ov).forEach(k => keys.add(k));
                    return Array.from(keys);
                }
                return columns;
            },

            getOwnPropertyDescriptor(target, prop) {
                const ov = overrides.get(index);
                if ((ov && prop in ov) || (values && values[prop])) {
                    return { enumerable: true, configurable: true, writable: true };
                }
                return undefined;
            },

            has(target, prop) {
                const ov = overrides.get(index);
                return (ov && prop in ov) || (values && prop in values);
            }
        });
    }

    map(callback) {
        const result = new Array(this.length);
        for (let i = 0; i < this.length; i++) {
            result[i] = callback(this.get(i), i, this);
        }
        return result;
    }

    filter(callback) {
        const result = [];
        for (let i = 0; i < this.length; i++) {
            const item = this.get(i);
            if (callback(item, i, this)) {
                result.push(item);
            }
        }
        return result;
    }

    forEach(callback) {
        for (let i = 0; i < this.length; i++) {
            callback(this.get(i), i, this);
        }
    }

    reduce(callback, initialValue) {
        let accumulator = initialValue;
        for (let i = 0; i < this.length; i++) {
            if (i === 0 && initialValue === undefined) {
                accumulator = this.get(i);
            } else {
                accumulator = callback(accumulator, this.get(i), i, this);
            }
        }
        return accumulator;
    }

    values() {
        // Returns all items as Proxies (expensive if iterated fully, but needed for 'no filter' cases)
        const result = new Array(this.length);
        for (let i = 0; i < this.length; i++) {
            result[i] = this.get(i);
        }
        return result;
    }

    some(callback) {
        for (let i = 0; i < this.length; i++) {
            if (callback(this.get(i), i)) return true;
        }
        return false;
    }

    every(callback) {
        for (let i = 0; i < this.length; i++) {
            if (!callback(this.get(i), i)) return false;
        }
        return true;
    }

    find(callback) {
        for (let i = 0; i < this.length; i++) {
            const item = this.get(i);
            if (callback(item, i)) return item;
        }
        return undefined;
    }

    [Symbol.iterator]() {
        let index = 0;
        return {
            next: () => {
                if (index < this.length) {
                    return { value: this.get(index++), done: false };
                } else {
                    return { done: true };
                }
            }
        };
    }
}

// Custom Map implementation for Index-based storage
export class IndexMap {
    constructor(dataSource) {
        this._indices = new Map();
        this._source = dataSource;
    }

    set(key, index) {
        this._indices.set(key, index);
    }

    get(key) {
        const index = this._indices.get(key);
        if (index === undefined) return undefined;
        return this._source.get(index);
    }

    getIndex(key) {
        return this._indices.get(key);
    }

    has(key) {
        return this._indices.has(key);
    }

    values() {
        const objects = [];
        for (const index of this._indices.values()) {
            objects.push(this._source.get(index));
        }
        return objects;
    }

    forEach(callback) {
        this._indices.forEach((index, key) => {
            callback(this._source.get(index), key);
        });
    }
}

// --- STATE MANAGEMENT ---
export const state = {
    allSalesData: null,
    allHistoryData: null,
    allClientsData: null,
    optimizedData: {
        salesById: null,
        historyById: null,
        indices: {
            current: {
                bySupervisor: new Map(),
                byRca: new Map(),
                byPasta: new Map(),
                bySupplier: new Map(),
                byClient: new Map(),
                byPosition: new Map(),
                byRede: new Map(),
                byTipoVenda: new Map(),
                byProduct: new Map(),
                byCity: new Map(),
                byFilial: new Map()
            },
            history: {
                bySupervisor: new Map(),
                byRca: new Map(),
                byPasta: new Map(),
                bySupplier: new Map(),
                byClient: new Map(),
                byPosition: new Map(),
                byRede: new Map(),
                byTipoVenda: new Map(),
                byProduct: new Map(),
                byCity: new Map(),
                byFilial: new Map()
            }
        },
        searchIndices: {
            clients: [], // [{ code, nameLower, cityLower }]
            products: [] // [{ code, descLower }]
        },
        hierarchyMap: new Map(),
        clientHierarchyMap: new Map(),
        coordMap: new Map(),
        cocoordMap: new Map(),
        promotorMap: new Map(),
        coordsByCocoord: new Map(),
        cocoordsByCoord: new Map(),
        promotorsByCocoord: new Map(),
        clientsByRca: new Map(),
        rcasBySupervisor: new Map(),
        productsBySupplier: new Map(),
        salesByProduct: { current: new Map(), history: new Map() },
        rcaCodeByName: new Map(),
        rcaNameByCode: new Map(),
        supervisorCodeByName: new Map(),
        productPastaMap: new Map()
    },
    clientMapForKPIs: new Map(),
    clientsWithSalesThisMonth: new Set(),
    sellerDetailsMap: new Map(),
    clientLastBranch: new Map(),
    clientRamoMap: new Map(),
    productDetailsMap: new Map(),
    activeProductCodesFromCadastro: new Set(),
    lastSaleDate: new Date(),
    maxWorkingDaysStock: 0,
    sortedWorkingDays: [],
    customWorkingDaysStock: 0,
    historicalBests: {},
    clientCoordinates: [],
    metadata: [],
    hierarchy: [],
    clientPromoters: [],
    stockMap05: {},
    stockMap08: {},
    aggregatedOrders: [],
    innovationsMonthData: [],
    passedWorkingDaysCurrentMonth: 1
};

export function sanitizeData(data) {
    if (!data) return [];
    const forbidden = ['SUPERV', 'CODUSUR', 'CODSUPERVISOR', 'NOME', 'CODCLI', 'PRODUTO', 'DESCRICAO', 'FORNECEDOR', 'OBSERVACAOFOR', 'CODFOR', 'QTVENDA', 'VLVENDA', 'VLBONIFIC', 'TOTPESOLIQ', 'ESTOQUEUNIT', 'TIPOVENDA', 'FILIAL', 'ESTOQUECX', 'SUPERVISOR'];

    if (Array.isArray(data)) {
        return data.filter(item => {
            const superv = String(item.SUPERV || '').trim().toUpperCase();
            const nome = String(item.NOME || '').trim().toUpperCase();
            const codUsur = String(item.CODUSUR || '').trim().toUpperCase();
            if (forbidden.includes(superv) || forbidden.includes(nome) || forbidden.includes(codUsur)) return false;
            return true;
        });
    }
    return data;
}

export function initializeOptimizedDataStructures(embeddedData) {
    console.log("[Data] Initializing optimized structures...");

    // Reset Structures
    state.sellerDetailsMap.clear();
    const sellerLastSaleDateMap = new Map();
    const clientToCurrentSellerMap = new Map();
    let americanasCodCli = null;

    // Load Basic Data
    if (embeddedData.isColumnar) {
        state.allSalesData = new ColumnarDataset(embeddedData.detailed);
        state.allHistoryData = new ColumnarDataset(embeddedData.history);
        state.allClientsData = new ColumnarDataset(embeddedData.clients);
    } else {
        state.allSalesData = sanitizeData(embeddedData.detailed);
        state.allHistoryData = sanitizeData(embeddedData.history);
        state.allClientsData = embeddedData.clients;
    }

    // Populate State with Embedded Data
    state.clientCoordinates = embeddedData.clientCoordinates || [];
    state.metadata = embeddedData.metadata || [];
    state.hierarchy = embeddedData.hierarchy || [];
    state.clientPromoters = embeddedData.clientPromoters || [];
    state.stockMap05 = embeddedData.stockMap05 || {};
    state.stockMap08 = embeddedData.stockMap08 || {};
    state.aggregatedOrders = embeddedData.byOrder || [];
    state.innovationsMonthData = embeddedData.innovationsMonth || [];
    state.passedWorkingDaysCurrentMonth = embeddedData.passedWorkingDaysCurrentMonth || 1;

    state.optimizedData.salesById = state.allSalesData;
    state.optimizedData.historyById = state.allHistoryData;

    // Helper Accessors
    const getClient = (i) => state.allClientsData instanceof ColumnarDataset ? state.allClientsData.get(i) : state.allClientsData[i];
    const getHistory = (i) => state.allHistoryData instanceof ColumnarDataset ? state.allHistoryData.get(i) : state.allHistoryData[i];
    const getSales = (i) => state.allSalesData instanceof ColumnarDataset ? state.allSalesData.get(i) : state.allSalesData[i];

    // --- 1. Process History for Supervisors & Sellers ---
    for (let i = 0; i < state.allHistoryData.length; i++) {
        const s = getHistory(i);
        const codUsur = s.CODUSUR;
        if (codUsur && s.NOME !== 'INATIVOS' && s.NOME !== 'AMERICANAS') {
            const dt = parseDate(s.DTPED);
            const ts = dt ? dt.getTime() : 0;
            const lastTs = sellerLastSaleDateMap.get(codUsur) || 0;

            if (ts >= lastTs || !state.sellerDetailsMap.has(codUsur)) {
                sellerLastSaleDateMap.set(codUsur, ts);
                state.sellerDetailsMap.set(codUsur, { name: s.NOME, supervisor: s.SUPERV });
            }
        }
    }

    // --- 2. Process Clients ---
    state.optimizedData.searchIndices.clients = new Array(state.allClientsData.length);

    for (let i = 0; i < state.allClientsData.length; i++) {
        const client = getClient(i);
        const codCli = normalizeKey(client['Código'] || client['codigo_cliente']);

        if (!codCli || codCli === 'Código' || codCli === 'codigo_cliente' || codCli === 'CODCLI' || codCli === 'CODIGO') continue;

        // Normalization
        client.cidade = client.cidade || client.CIDADE || 'N/A';
        client.bairro = client.bairro || client.BAIRRO || 'N/A';
        client.ramo = client.ramo || client.RAMO || 'N/A';
        client.nomeCliente = client.nomeCliente || client.razaoSocial || client.RAZAOSOCIAL || client.Cliente || client.CLIENTE || client.NOMECLIENTE || 'N/A';

        const rca1 = client.rca1 || client['RCA 1'] || client.RCA1;
        client.rca1 = rca1;

        const razaoSocial = client.razaoSocial || client.RAZAOSOCIAL || client.Cliente || '';

        if (razaoSocial.toUpperCase().includes('AMERICANAS')) {
            client.rca1 = SPECIAL_CLIENTS.AMERICANAS.RCA_ID;
            client.rcas = [SPECIAL_CLIENTS.AMERICANAS.RCA_ID];
            americanasCodCli = codCli;
            state.optimizedData.rcaCodeByName.set('AMERICANAS', SPECIAL_CLIENTS.AMERICANAS.RCA_ID);
            state.sellerDetailsMap.set(SPECIAL_CLIENTS.AMERICANAS.RCA_ID, { name: 'AMERICANAS', supervisor: 'BALCAO' });
        }

        if (client.rca1) clientToCurrentSellerMap.set(codCli, String(client.rca1));
        state.clientRamoMap.set(codCli, client.ramo);
        state.clientMapForKPIs.set(codCli, client);

        let rcas = client.rcas || client.RCAS;
        if (Array.isArray(rcas)) {
            rcas = rcas.filter(r => r && String(r).toLowerCase() !== 'rcas');
        } else if (typeof rcas === 'string' && rcas.toLowerCase() === 'rcas') {
            rcas = [];
        }
        client.rcas = rcas;

        if (rcas) {
            for (let j = 0; j < rcas.length; j++) {
                const rca = rcas[j];
                if (rca) {
                    if (!state.optimizedData.clientsByRca.has(rca)) state.optimizedData.clientsByRca.set(rca, []);
                    state.optimizedData.clientsByRca.get(rca).push(client);
                }
            }
        }

        state.optimizedData.searchIndices.clients[i] = { code: codCli, nameLower: (client.nomeCliente || '').toLowerCase(), cityLower: (client.cidade || '').toLowerCase() };
    }

    // --- 3. Process Hierarchy ---
    if (embeddedData.hierarchy) {
        embeddedData.hierarchy.forEach(h => {
            const getVal = (keys) => {
                for (const k of keys) {
                    if (h[k] !== undefined && h[k] !== null) return String(h[k]);
                }
                return '';
            };

            const coordCode = getVal(['cod_coord', 'COD_COORD', 'COD COORD.']).trim().toUpperCase();
            const coordName = (getVal(['nome_coord', 'NOME_COORD', 'COORDENADOR']) || coordCode).toUpperCase();
            const cocoordCode = getVal(['cod_cocoord', 'COD_COCOORD', 'COD CO-COORD.']).trim().toUpperCase();
            const cocoordName = (getVal(['nome_cocoord', 'NOME_COCOORD', 'CO-COORDENADOR']) || cocoordCode).toUpperCase();
            const promotorCode = getVal(['cod_promotor', 'COD_PROMOTOR', 'COD PROMOTOR']).trim().toUpperCase();
            const promotorName = (getVal(['nome_promotor', 'NOME_PROMOTOR', 'PROMOTOR']) || promotorCode).toUpperCase();

            if (coordCode) {
                state.optimizedData.coordMap.set(coordCode, coordName);
                if (!state.optimizedData.cocoordsByCoord.has(coordCode)) state.optimizedData.cocoordsByCoord.set(coordCode, new Set());
                if (cocoordCode) state.optimizedData.cocoordsByCoord.get(coordCode).add(cocoordCode);
            }
            if (cocoordCode) {
                state.optimizedData.cocoordMap.set(cocoordCode, cocoordName);
                if (coordCode) state.optimizedData.coordsByCocoord.set(cocoordCode, coordCode);
                if (!state.optimizedData.promotorsByCocoord.has(cocoordCode)) state.optimizedData.promotorsByCocoord.set(cocoordCode, new Set());
                if (promotorCode) state.optimizedData.promotorsByCocoord.get(cocoordCode).add(promotorCode);
            }
            if (promotorCode) state.optimizedData.promotorMap.set(promotorCode, promotorName);

            if (promotorCode) {
                state.optimizedData.hierarchyMap.set(promotorCode, {
                    coord: { code: coordCode, name: coordName },
                    cocoord: { code: cocoordCode, name: cocoordName },
                    promotor: { code: promotorCode, name: promotorName }
                });
            }
        });
    }

    if (embeddedData.clientPromoters) {
        embeddedData.clientPromoters.forEach(cp => {
            let clientCode = normalizeKey(cp.client_code);
            const promotorCode = String(cp.promoter_code).trim().toUpperCase();
            const hierarchyNode = state.optimizedData.hierarchyMap.get(promotorCode);
            if (hierarchyNode) {
                state.optimizedData.clientHierarchyMap.set(clientCode, hierarchyNode);
            }
        });
    }

    // --- 4. Index Sales Data ---
    const supervisorToRcaMap = new Map();
    const workingDaysSet = new Set();

    const processDatasetForIndices = (data, indexSet, isHistory) => {
        const { bySupervisor, byRca, byPasta, bySupplier, byClient, byPosition, byRede, byTipoVenda, byProduct, byCity, byFilial } = indexSet;
        const isColumnar = data instanceof ColumnarDataset;
        const colValues = isColumnar ? data._data : null;

        const getVal = (i, prop) => {
            if (isColumnar && colValues && colValues[prop]) {
                return colValues[prop][i];
            }
            if (isColumnar) {
                 const item = data.get(i);
                 return item ? item[prop] : undefined;
            }
            return data[i] ? data[i][prop] : undefined;
        };

        for (let i = 0; i < data.length; i++) {
            const id = i;
            const supervisor = getVal(i, 'SUPERV') || 'N/A';
            const rca = getVal(i, 'NOME') || 'N/A';

            let pasta = getVal(i, 'OBSERVACAOFOR');
            if (!pasta || pasta === '0' || pasta === '00' || pasta === 'N/A') {
                const rawFornecedor = String(getVal(i, 'FORNECEDOR') || '').toUpperCase();
                pasta = rawFornecedor.includes('PEPSICO') ? 'PEPSICO' : 'MULTIMARCAS';
            }

            const supplier = getVal(i, 'CODFOR');
            const client = getVal(i, 'CODCLI');
            const position = getVal(i, 'POSICAO') || 'N/A';
            const rede = state.clientRamoMap.get(client) || 'N/A';
            const tipoVenda = getVal(i, 'TIPOVENDA');
            const product = getVal(i, 'PRODUTO');
            const clientObj = state.clientMapForKPIs.get(String(client));
            const city = (clientObj ? (clientObj.cidade || clientObj['Nome da Cidade']) : 'N/A').toLowerCase();
            const filial = getVal(i, 'FILIAL');
            const codUsur = getVal(i, 'CODUSUR');
            const codSupervisor = getVal(i, 'CODSUPERVISOR');

            if (!bySupervisor.has(supervisor)) bySupervisor.set(supervisor, new Set()); bySupervisor.get(supervisor).add(id);
            if (!byRca.has(rca)) byRca.set(rca, new Set()); byRca.get(rca).add(id);
            if (!byPasta.has(pasta)) byPasta.set(pasta, new Set()); byPasta.get(pasta).add(id);
            if (supplier) { if (!bySupplier.has(supplier)) bySupplier.set(supplier, new Set()); bySupplier.get(supplier).add(id); }
            if (client) { if (!byClient.has(client)) byClient.set(client, new Set()); byClient.get(client).add(id); }
            if (tipoVenda) { if (!byTipoVenda.has(tipoVenda)) byTipoVenda.set(tipoVenda, new Set()); byTipoVenda.get(tipoVenda).add(id); }
            if (position) { if (!byPosition.has(position)) byPosition.set(position, new Set()); byPosition.get(position).add(id); }
            if (rede) { if (!byRede.has(rede)) byRede.set(rede, new Set()); byRede.get(rede).add(id); }
            if (product) { if (!byProduct.has(product)) byProduct.set(product, new Set()); byProduct.get(product).add(id); }
            if (city) { if (!byCity.has(city)) byCity.set(city, new Set()); byCity.get(city).add(id); }
            if (filial) { if (!byFilial.has(filial)) byFilial.set(filial, new Set()); byFilial.get(filial).add(id); }

            if (codUsur && supervisor) { if (!supervisorToRcaMap.has(supervisor)) supervisorToRcaMap.set(supervisor, new Set()); supervisorToRcaMap.get(supervisor).add(codUsur); }
            if (supplier && product) { if (!state.optimizedData.productsBySupplier.has(supplier)) state.optimizedData.productsBySupplier.set(supplier, new Set()); state.optimizedData.productsBySupplier.get(supplier).add(product); }
            if (rca && codUsur) { state.optimizedData.rcaCodeByName.set(rca, codUsur); state.optimizedData.rcaNameByCode.set(codUsur, rca); }
            if (supervisor && codSupervisor) { state.optimizedData.supervisorCodeByName.set(supervisor, codSupervisor); }
            if (client && filial) { state.clientLastBranch.set(client, filial); }
            if (product && pasta && !state.optimizedData.productPastaMap.has(product)) { state.optimizedData.productPastaMap.set(product, pasta); }

            if (!isHistory) {
                // Populate Active Clients with Sales
                state.clientsWithSalesThisMonth.add(client);
            }

            const dtPed = getVal(i, 'DTPED');
            if (dtPed) {
                const dateObj = (typeof dtPed === 'number') ? new Date(dtPed) : parseDate(dtPed);
                if(dateObj && !isNaN(dateObj.getTime())) {
                    const dayOfWeek = dateObj.getUTCDay();
                    if (dayOfWeek >= 1 && dayOfWeek <= 5) workingDaysSet.add(dateObj.toISOString().split('T')[0]);
                }
            }

            if (product) {
                const targetMap = isHistory ? state.optimizedData.salesByProduct.history : state.optimizedData.salesByProduct.current;
                if (!targetMap.has(product)) targetMap.set(product, []);
                targetMap.get(product).push(isColumnar ? data.get(i) : data[i]);
            }
        }
    };

    processDatasetForIndices(state.allSalesData, state.optimizedData.indices.current, false);
    processDatasetForIndices(state.allHistoryData, state.optimizedData.indices.history, true);

    // --- 5. Backfill Maps ---
    state.productDetailsMap = new Map(Object.entries(embeddedData.productDetails || {}));
    state.activeProductCodesFromCadastro = new Set(embeddedData.activeProductCodes || []);

    const codforToPastaMap = new Map();
    state.optimizedData.productPastaMap.forEach((pasta, productCode) => {
        const details = state.productDetailsMap.get(productCode);
        if (details && details.codfor) {
            if (!codforToPastaMap.has(details.codfor)) {
                codforToPastaMap.set(details.codfor, pasta);
            }
        }
    });

    state.productDetailsMap.forEach((details, productCode) => {
        if (!state.optimizedData.productPastaMap.has(productCode) && details.codfor) {
            const inferredPasta = codforToPastaMap.get(details.codfor);
            if (inferredPasta) {
                state.optimizedData.productPastaMap.set(productCode, inferredPasta);
            }
        }
    });

    supervisorToRcaMap.forEach((rcas, supervisor) => {
        state.optimizedData.rcasBySupervisor.set(supervisor, Array.from(rcas));
    });

    state.sortedWorkingDays = Array.from(workingDaysSet).sort((a, b) => new Date(a) - new Date(b));
    state.maxWorkingDaysStock = workingDaysSet.size > 0 ? workingDaysSet.size : 1;
    state.customWorkingDaysStock = state.maxWorkingDaysStock;

    // --- 6. Calculate Max Date ---
    let maxDateTs = 0;
    for(let i=0; i<state.allSalesData.length; i++) {
        const s = getSales(i);
        let ts = 0;
        if (typeof s.DTPED === 'number' && s.DTPED > 1000000) {
             ts = s.DTPED;
        } else {
             const d = parseDate(s.DTPED);
             if(d && !isNaN(d)) ts = d.getTime();
        }
        if(ts > maxDateTs) maxDateTs = ts;
    }
    state.lastSaleDate = maxDateTs > 0 ? new Date(maxDateTs) : new Date();
    state.lastSaleDate.setUTCHours(0,0,0,0);
}

export function calculateHistoricalBests() {
    state.historicalBests = {};
    const salesByDay = new Map();

    const process = (dataset) => {
        const isColumnar = dataset instanceof ColumnarDataset;
        const len = dataset.length;
        for (let i = 0; i < len; i++) {
            const s = isColumnar ? dataset.get(i) : dataset[i];
            const d = parseDate(s.DTPED);
            if (!d) continue;
            const dateKey = d.toISOString().split('T')[0];

            if (!salesByDay.has(dateKey)) salesByDay.set(dateKey, 0);
            salesByDay.set(dateKey, salesByDay.get(dateKey) + (Number(s.VLVENDA) || 0));
        }
    };

    process(state.allHistoryData);

    let max = 0;
    salesByDay.forEach(val => { if (val > max) max = val; });
    state.historicalBests.day = max;
}

// Global Application State

window.AppState = {
    // Data Sets
    allSalesData: null,
    allHistoryData: null,
    allClientsData: null,

    // Aggregated Data
    aggregatedOrders: null,
    stockData05: new Map(),
    stockData08: new Map(),
    innovationsMonthData: null,

    // Mapped Indices
    clientMapForKPIs: null, // Map or IndexMap
    productDetailsMap: new Map(),
    activeProductCodesFromCadastro: new Set(),

    // Optimized Search Structures
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
            clients: [],
            products: []
        },
        // Hierarchy Maps
        hierarchyMap: new Map(),
        clientHierarchyMap: new Map(),
        coordMap: new Map(),
        cocoordMap: new Map(),
        promotorMap: new Map(),
        coordsByCocoord: new Map(),
        cocoordsByCoord: new Map(),
        promotorsByCocoord: new Map(),

        // Filter State
        hierarchyState: {},

        // Other Maps
        clientsByRca: new Map(),
        rcasBySupervisor: new Map(),
        productsBySupplier: new Map(),
        salesByProduct: { current: new Map(), history: new Map() },
        rcaCodeByName: new Map(),
        rcaNameByCode: new Map(),
        supervisorCodeByName: new Map(),
        productPastaMap: new Map()
    },

    // Session Context
    userHierarchyContext: {
        role: 'promotor', // default safe
        coord: null,
        cocoord: null,
        promotor: null
    },

    // UI State
    viewState: {
        dashboard: { dirty: true },
        pedidos: { dirty: true },
        comparativo: { dirty: true },
        cobertura: { dirty: true },
        cidades: { dirty: true },
        inovacoes: { dirty: true, cache: null, lastTypesKey: '' },
        mix: { dirty: true },
        goals: { dirty: true },
        metaRealizado: { dirty: true },
        clientes: { dirty: true },
        produtos: { dirty: true },
        consultas: { dirty: true }
    },

    charts: {}, // Chart.js instances
    amChartRoots: {
        weekly: null,
        monthly: null,
        innovations: null,
        categoryRadar: null
    },

    // Goals State
    globalGoalsMetrics: {},
    globalClientGoals: new Map(),
    quarterMonths: [],

    // Time
    lastSaleDate: null,
    maxWorkingDaysStock: 0,
    customWorkingDaysStock: 0,
    passedWorkingDaysCurrentMonth: 1,
    sortedWorkingDays: [],

    // Maps
    clientLastBranch: new Map(),
    clientRamoMap: new Map(),
    sellerDetailsMap: new Map(),

    // Geo
    clientCoordinatesMap: new Map(),

    // Visit State (Local cache)
    myMonthVisits: new Map()
};

// Expose aliases if needed for backward compatibility or easy access in console
window.globalClientGoals = window.AppState.globalClientGoals;

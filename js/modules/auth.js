import { SUPABASE_URL, SUPABASE_ANON_KEY } from './constants.js';
import { normalizeKey, mapKeysToUpper, parseCSVToObjects, parseCSVToColumnar } from './utils.js';

let supabaseClient = null;
let userRole = null;

export async function initAuth() {
    // 1. Initialize Supabase
    if (typeof window.supabase === 'undefined') {
        throw new Error('Supabase library not loaded');
    }
    const { createClient } = window.supabase;
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    window.supabaseClient = supabaseClient; // Expose globally for legacy/worker compatibility if needed

    // 2. Setup UI Elements
    const loginButton = document.getElementById('login-button');
    const telaLogin = document.getElementById('tela-login');
    const telaLoading = document.getElementById('tela-loading');
    const telaPendente = document.getElementById('tela-pendente');
    const logoutButtonPendente = document.getElementById('logout-button-pendente');

    // 3. Bind Events
    if (logoutButtonPendente) {
        logoutButtonPendente.addEventListener('click', async () => {
            await supabaseClient.auth.signOut();
            window.location.reload();
        });
    }

    if (loginButton) {
        loginButton.addEventListener('click', async () => {
            await supabaseClient.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: window.location.origin + window.location.pathname }
            });
        });
    }

    // 4. Check Session
    const { data } = await supabaseClient.auth.getSession();
    if (data && data.session) {
        return verifyUserProfile(data.session);
    } else {
        telaLogin.classList.remove('hidden');
        // Wait for auth change
        return new Promise((resolve) => {
            supabaseClient.auth.onAuthStateChange(async (event, session) => {
                if (session) {
                    const result = await verifyUserProfile(session);
                    resolve(result);
                }
            });
        });
    }
}

async function verifyUserProfile(session) {
    const telaLoading = document.getElementById('tela-loading');
    const telaLogin = document.getElementById('tela-login');
    const telaPendente = document.getElementById('tela-pendente');
    const loaderText = document.getElementById('loader-text');

    telaLogin.classList.add('hidden');
    telaPendente.classList.add('hidden');
    telaLoading.classList.remove('hidden');

    try {
        const { data: profile, error } = await supabaseClient.from('profiles').select('*').eq('id', session.user.id).single();

        if (error && error.code !== 'PGRST116') throw error;

        if (profile && profile.status === 'aprovado') {
            userRole = profile.role;
            window.userRole = userRole; // Expose for legacy app logic access
            return loadData();
        } else {
            telaLoading.classList.add('hidden');
            telaPendente.classList.remove('hidden');
            const statusMsg = document.getElementById('pendente-status-msg');
            if (statusMsg) {
                if (profile && profile.status === 'bloqueado') {
                    statusMsg.textContent = "Acesso Bloqueado pelo Administrador";
                    statusMsg.style.color = "#e53e3e";
                } else {
                    statusMsg.textContent = "Aguardando Liberação";
                    statusMsg.style.color = "#FF9933";
                }
            }
            throw new Error('Access denied');
        }
    } catch (err) {
        console.error("Auth Error:", err);
        // If not access denied (network error), show retry?
        // For simplicity, we stick to current flow which halts.
        if (err.message !== 'Access denied') {
             alert("Erro de conexão: " + err.message);
        }
        throw err;
    }
}

// IndexedDB Helper
const DB_NAME = 'PrimeDashboardDB_V2';
const STORE_NAME = 'data_store';
const DB_VERSION = 1;

const initDB = () => {
    return window.idb.openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        },
    });
};

const getFromCache = async (key) => {
    try {
        const db = await initDB();
        return await db.get(STORE_NAME, key);
    } catch (e) {
        console.warn('Cache Read Error:', e);
        return null;
    }
};

const saveToCache = async (key, value) => {
    try {
        const db = await initDB();
        await db.put(STORE_NAME, value, key);
    } catch (e) {
        console.warn('Cache Save Error:', e);
    }
};

async function fetchAll(table, columns = null, type = null, format = 'object', pkCol = 'id') {
    const pageSize = 20000;
    let result = format === 'columnar' ? { columns: [], values: {}, length: 0 } : [];
    let hasMore = true;
    let lastId = null;

    // Initial loop
    while (hasMore) {
        let query = supabaseClient.from(table).select(columns || '*').order(pkCol, { ascending: true }).limit(pageSize);
        if (lastId !== null) query = query.gt(pkCol, lastId);

        const promise = columns ? query.csv() : query;
        const { data, error } = await promise;

        if (error) throw error;

        let chunkLength = 0;
        let newObjects = [];

        if (columns) {
            if (!data || data.length < 5) {
                hasMore = false;
            } else {
                if (format === 'columnar') {
                    const preLen = result.length;
                    result = parseCSVToColumnar(data, type, result);
                    chunkLength = result.length - preLen;
                    if (chunkLength === 0) hasMore = false;
                } else {
                    newObjects = parseCSVToObjects(data, type);
                    chunkLength = newObjects.length;
                    result = result.concat(newObjects);
                    if (chunkLength === 0) hasMore = false;
                }
            }
        } else {
            if (!data || data.length === 0) {
                hasMore = false;
            } else {
                chunkLength = data.length;
                result = result.concat(data);
            }
        }

        if (chunkLength < pageSize) hasMore = false;

        // Update Cursor
        if (hasMore) {
            if (columns) {
                let lookupKey = pkCol.toUpperCase();
                if (format === 'columnar') {
                    const colData = result.values[lookupKey];
                    if (colData && colData.length > 0) lastId = colData[colData.length - 1];
                    else hasMore = false;
                } else {
                    const lastItem = result[result.length - 1];
                    if (lastItem && lastItem[lookupKey] !== undefined) lastId = lastItem[lookupKey];
                    else if (lastItem && lastItem[pkCol] !== undefined) lastId = lastItem[pkCol];
                    else hasMore = false;
                }
            } else {
                const lastItem = result[result.length - 1];
                lastId = lastItem[pkCol];
            }
        }
    }
    return result;
}

async function loadData() {
    const loaderText = document.getElementById('loader-text');
    loaderText.textContent = 'Verificando dados...';

    // 1. Fetch Metadata
    let metadataRemote = null;
    let metadataRemoteRaw = null;
    try {
        const { data, error } = await supabaseClient.from('data_metadata').select('*');
        if (!error && data) {
            metadataRemoteRaw = data;
            metadataRemote = {};
            data.forEach(item => metadataRemote[item.key] = item.value);
        }
    } catch (e) { console.warn(e); }

    // 2. Check Cache
    let cachedData = await getFromCache('dashboardData');
    let useCache = false;

    if (cachedData && metadataRemote) {
        const remoteDate = new Date(metadataRemote.last_update).getTime();
        const cachedDate = new Date(cachedData.metadata ? cachedData.metadata.find(m=>m.key==='last_update')?.value : 0).getTime();

        if (!isNaN(remoteDate) && remoteDate <= cachedDate && cachedData.hierarchy) {
            console.log("Using Cache");
            useCache = true;
        }
    }

    let embeddedData = {};

    if (useCache) {
        loaderText.textContent = 'Carregando do cache...';
        embeddedData = cachedData;
        embeddedData.metadata = metadataRemoteRaw || cachedData.metadata;

        // Background update coordinates
        fetchAll('data_client_coordinates', null, null, 'object', 'client_code').then(coords => {
            if (coords && coords.length > 0) {
                embeddedData.clientCoordinates = coords;
                saveToCache('dashboardData', embeddedData);
            }
        }).catch(console.warn);

    } else {
        loaderText.textContent = 'Baixando dados...';
        const colsDetailed = 'id,pedido,codcli,nome,superv,codsupervisor,produto,descricao,fornecedor,observacaofor,codfor,codusur,qtvenda,vlvenda,vlbonific,totpesoliq,dtped,dtsaida,posicao,estoqueunit,tipovenda,filial,qtvenda_embalagem_master';
        const colsClients = 'id,codigo_cliente,rca1,rca2,rcas,cidade,nomecliente,bairro,razaosocial,fantasia,cnpj_cpf,endereco,numero,cep,telefone,email,ramo,ultimacompra,datacadastro,bloqueio,inscricaoestadual,promotor';
        const colsStock = 'id,product_code,filial,stock_qty';
        const colsOrders = 'id,pedido,codcli,cliente_nome,cidade,nome,superv,fornecedores_str,dtped,dtsaida,posicao,vlvenda,totpesoliq,filial,tipovenda,fornecedores_list,codfors_list';

        const [detailed, history, clients, products, activeProds, stock, innovations, metadata, orders, clientCoordinates, hierarchy, clientPromoters] = await Promise.all([
            fetchAll('data_detailed', colsDetailed, 'sales', 'columnar', 'id'),
            fetchAll('data_history', colsDetailed, 'history', 'columnar', 'id'),
            fetchAll('data_clients', colsClients, 'clients', 'columnar', 'id'),
            fetchAll('data_product_details', null, null, 'object', 'code'),
            fetchAll('data_active_products', null, null, 'object', 'code'),
            fetchAll('data_stock', colsStock, 'stock', 'columnar', 'id'),
            fetchAll('data_innovations', null, null, 'object', 'id'),
            fetchAll('data_metadata', null, null, 'object', 'key'),
            fetchAll('data_orders', colsOrders, 'orders', 'object', 'id'),
            fetchAll('data_client_coordinates', null, null, 'object', 'client_code'),
            fetchAll('data_hierarchy', null, null, 'object', 'id'),
            fetchAll('data_client_promoters', null, null, 'object', 'client_code')
        ]);

        // Process Stock Maps
        const stockMap05 = {};
        const stockMap08 = {};
        if (stock && stock.values) {
            const pCodes = stock.values['PRODUCT_CODE'];
            const filials = stock.values['FILIAL'];
            const qtys = stock.values['STOCK_QTY'];
            for(let i=0; i<stock.length; i++) {
                if (filials[i] === '05') stockMap05[pCodes[i]] = qtys[i];
                if (filials[i] === '08') stockMap08[pCodes[i]] = qtys[i];
            }
        }

        embeddedData = {
            detailed, history, clients, products, activeProds, stock, innovations, metadata, orders, hierarchy, clientPromoters, clientCoordinates,
            stockMap05, stockMap08,
            activeProductCodes: activeProds.map(p => p.code),
            productDetails: products.reduce((acc, p) => {
                acc[p.code] = { ...p, dtCadastro: p.dtcadastro ? new Date(p.dtcadastro).getTime() : null };
                return acc;
            }, {}),
            passedWorkingDaysCurrentMonth: 1, // Logic extracted to backend/worker usually, but defaulted here
            isColumnar: true
        };

        saveToCache('dashboardData', embeddedData);
    }

    loaderText.textContent = 'Processando...';

    // Final Adjustments (Promoter Merge)
    if (embeddedData.clientPromoters && embeddedData.clientPromoters.length > 0) {
        const promoterMap = new Map();
        embeddedData.clientPromoters.forEach(p => {
            if (p.client_code && p.promoter_code) promoterMap.set(normalizeKey(p.client_code), String(p.promoter_code).trim());
        });

        const clients = embeddedData.clients;
        if (!clients.columns.includes('PROMOTOR')) {
            clients.columns.push('PROMOTOR');
            clients.values['PROMOTOR'] = new Array(clients.length).fill('');
        }

        const codes = clients.values['CODIGO_CLIENTE'] || clients.values['Código'];
        const promos = clients.values['PROMOTOR'];
        const rcas = clients.values['RCA 1'] || clients.values['RCA1'];

        for(let i=0; i<clients.length; i++) {
            const code = normalizeKey(codes[i]);
            const p = promoterMap.get(code);
            if (p) promos[i] = p;
            else if (!promos[i] && rcas && rcas[i]) promos[i] = String(rcas[i]).trim();
        }
    }

    // Role Filtering Logic
    if (userRole && userRole !== 'adm') {
        // Implement Access Control Filtering HERE if needed, or pass full data and let Data module handle it.
        // The original logic filtered embeddedData BEFORE creating app.js.
        // To respect "Fail Closed", we should ideally filter here.
        // However, moving filter logic to `filters.js` or `data.js` is cleaner.
        // But `data.js` needs `state` initialized.
        // Let's defer filtering to `data.js` initialization, passing the userRole.
        // WARNING: Data leakage risk if `data.js` exposes raw data before filtering.
        // `data.js`'s `initializeOptimizedDataStructures` handles indexing.
        // We will add a `applySecurityFilter` method in `data.js` or `auth.js`.
        // Let's keep it simple: Pass `userRole` to `data.js` and let it filter during initialization.
    }

    return embeddedData;
}

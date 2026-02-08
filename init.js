    const SUPABASE_URL = 'https://dldsocponbjthqxhmttj.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsZHNvY3BvbmJqdGhxeGhtdHRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MzgzMzgsImV4cCI6MjA4NTAxNDMzOH0.IGxUEd977uIdhWvMzjDM8ygfISB_Frcf_2air8e3aOs';

    // Helper to normalize keys (remove leading zeros)
    function normalizeKey(key) {
        if (!key) return '';
        const s = String(key).trim();
        // Remove leading zeros if it's a numeric string
        if (/^\d+$/.test(s)) {
            return String(parseInt(s, 10));
        }
        return s;
    }

    // Helper to UPPERCASE keys (Retained for Upload/CSV parsing in Admin Panel)
    function mapKeysToUpper(data, type) {
        if (!data || data.length === 0) return [];
        return data.map(item => {
            const newItem = {};
            for (const key in item) {
                let newKey = key.toUpperCase();
                // Ajustes finos para corresponder exatamente ao que o script espera
                if (type === 'clients') {
                    if (newKey === 'CODIGO_CLIENTE') newKey = 'Código';
                    if (newKey === 'RCA1') newKey = 'RCA 1';
                    if (newKey === 'RCA2') newKey = 'RCA 2';
                    if (newKey === 'NOMECLIENTE') newKey = 'Cliente';
                    if (newKey === 'RAZAOSOCIAL') newKey = 'razaoSocial';
                    if (newKey === 'ULTIMACOMPRA') newKey = 'Data da Última Compra';
                    if (newKey === 'DATACADASTRO') newKey = 'Data e Hora de Cadastro';
                    if (newKey === 'INSCRICAOESTADUAL') newKey = 'Insc. Est. / Produtor';
                    if (newKey === 'CNPJ_CPF') newKey = 'CNPJ/CPF';
                    if (newKey === 'ENDERECO') newKey = 'Endereço Comercial';
                    if (newKey === 'TELEFONE') newKey = 'Telefone Comercial';
                    if (newKey === 'DESCRICAO') newKey = 'Descricao';
                }
                if (newKey === 'CLIENTE_NOME') newKey = 'CLIENTE_NOME';

                if (item[key] !== null) {
                    if (newKey === 'DTPED' || newKey === 'DTSAIDA' || newKey === 'Data da Última Compra' || newKey === 'Data e Hora de Cadastro') {
                         newItem[newKey] = item[key];
                    } else if (newKey === 'QTVENDA' || newKey === 'VLVENDA' || newKey === 'VLBONIFIC' || newKey === 'TOTPESOLIQ' || newKey === 'ESTOQUECX' || newKey === 'ESTOQUEUNIT') {
                         const val = Number(item[key]);
                         newItem[newKey] = isNaN(val) ? 0 : val;
                    } else if (newKey === 'FILIAL') {
                         newItem[newKey] = String(item[key]);
                    } else {
                         newItem[newKey] = item[key];
                    }
                } else {
                     newItem[newKey] = item[key];
                }
            }
            return newItem;
        });
    }

    async function carregarDadosDoSupabase(supabaseClient) {
        isAppReady = true;
        const loader = document.getElementById('loader');
        const loaderText = document.getElementById('loader-text');

        try {
            loader.classList.remove('hidden');
            loaderText.textContent = 'Inicializando sistema (Modo Servidor)...';

            // Fetch Lightweight Configuration Data
            const [metadataFetched, hierarchyFetched, clientPromotersFetched, holidaysFetched] = await Promise.all([
                supabaseClient.from('data_metadata').select('*'),
                supabaseClient.from('data_hierarchy').select('*'),
                supabaseClient.from('data_client_promoters').select('*'),
                supabaseClient.from('data_holidays').select('*')
            ]);

            const metadata = {};
            if (metadataFetched.data) {
                metadataFetched.data.forEach(item => metadata[item.key] = item.value);
            }

            const hierarchy = hierarchyFetched.data || [];
            const clientPromoters = clientPromotersFetched.data || [];
            // Normalize Client Promoters Keys
            if (clientPromoters && clientPromoters.length > 0) {
                 clientPromoters.forEach(p => {
                     if (p.client_code) p.client_code = normalizeKey(p.client_code);
                 });
            }

            // Server-Side Mode Configuration
            const embeddedData = {
                isServerMode: true, // Flag for app.js
                isColumnar: true,
                metadata: metadata,
                hierarchy: hierarchy,
                clientPromoters: clientPromoters,
                holidays: holidaysFetched.data || [],

                // Empty placeholders for legacy compatibility (prevent crash on access)
                detailed: { columns: [], values: {}, length: 0 },
                history: { columns: [], values: {}, length: 0 },
                // Initialize with schema to allow dynamic injection in app.js
                clients: { 
                    columns: ['Código', 'Fantasia', 'Razão Social', 'CNPJ/CPF', 'Cidade', 'Bairro', 'RCA 1', 'PROMOTOR', 'Bloqueio'], 
                    values: {
                        'Código': [], 'Fantasia': [], 'Razão Social': [], 'CNPJ/CPF': [], 'Cidade': [], 'Bairro': [], 'RCA 1': [], 'PROMOTOR': [], 'Bloqueio': []
                    }, 
                    length: 0 
                }, 
                byOrder: [],
                stockMap05: {},
                stockMap08: {},
                innovationsMonth: [],
                activeProductCodes: [],
                productDetails: {},
                clientCoordinates: [],
                passedWorkingDaysCurrentMonth: 1
            };

            // Update Generation Date UI
            const lastUpdateText = document.getElementById('last-update-text');
            if (lastUpdateText) {
                let displayDate = Date.now();
                if (embeddedData.metadata && embeddedData.metadata['last_update']) {
                    displayDate = embeddedData.metadata['last_update'];
                }
                const dateObj = new Date(displayDate);
                if (!isNaN(dateObj.getTime())) {
                    const formattedDate = dateObj.toLocaleString('pt-BR');
                    lastUpdateText.textContent = `Dados atualizados em: ${formattedDate}`;
                }
            }

            window.embeddedData = embeddedData;
            window.isDataLoaded = true;

            // Inject App Logic
            const scriptEl = document.createElement('script');
            scriptEl.src = 'app.js?v=' + Date.now();
            scriptEl.onload = () => {
                loader.classList.add('hidden');
                document.getElementById('content-wrapper').classList.remove('hidden');
                const topNav = document.getElementById('top-navbar');
                if (topNav) topNav.classList.remove('hidden');
            };
            document.body.appendChild(scriptEl);

        } catch (e) {
            console.error(e);
            loaderText.textContent = 'Erro: ' + e.message;
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        const { createClient } = supabase;
        const supabaseClient = window.supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        // Gatekeeper Logic
        const loginButton = document.getElementById('login-button');
        const telaLogin = document.getElementById('tela-login');
        const telaLoading = document.getElementById('tela-loading');
        const telaPendente = document.getElementById('tela-pendente');

        // Logout Button Logic for Pending Screen
        const logoutButtonPendente = document.getElementById('logout-button-pendente');
        if (logoutButtonPendente) {
            logoutButtonPendente.addEventListener('click', async () => {
                const { error } = await supabaseClient.auth.signOut();
                if (error) console.error('Erro ao sair:', error);
                window.location.reload();
            });
        }

        loginButton.addEventListener('click', async () => {
            await supabaseClient.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: window.location.origin + window.location.pathname }
            });
        });

        let isCheckingProfile = false;
        let isAppReady = false;

        async function verifyUserProfile(session) {
            if (window.isDataLoaded) {
                const telaLoading = document.getElementById('tela-loading');
                const telaLogin = document.getElementById('tela-login');
                if (telaLoading) telaLoading.classList.add('hidden');
                if (telaLogin) telaLogin.classList.add('hidden');
                return;
            }

            if (isCheckingProfile || !session) return;
            isCheckingProfile = true;

            // Only Reset UI to Loading State if App is NOT Ready (Initial Load)
            if (!isAppReady) {
                telaLogin.classList.add('hidden');
                telaPendente.classList.add('hidden');
                const card = document.getElementById('loading-card-content');
                if (card) {
                    card.innerHTML = `
                        <h2 style="margin-top: 0; font-size: 1.5rem; font-weight: 600;">Carregando...</h2>
                        <p style="color: #a0aec0;">Verificando credenciais.</p>
                        <p style="color: #4a5568; font-size: 0.75rem; margin-top: 1rem;">vServer 2.0</p>
                    `;
                }
                telaLoading.classList.remove('hidden');
            }

            try {
                // Check Profile with Timeout - 15s
                const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Tempo limite de conexão excedido. Verifique sua internet.')), 15000));
                const profilePromise = supabaseClient.from('profiles').select('*').eq('id', session.user.id).single();

                const { data: profile, error } = await Promise.race([profilePromise, timeout]);

                if (error) {
                    if (error.code !== 'PGRST116') {
                        throw error;
                    }
                }

                if (profile && profile.status === 'aprovado') {
                    // Store user role globally
                    window.userRole = profile.role;

                    // Update Welcome Message
                    const welcomeEl = document.getElementById('welcome-header');
                    if (welcomeEl) {
                        const userName = session.user.user_metadata.full_name || session.user.user_metadata.name || session.user.email;
                        welcomeEl.innerHTML = `
                            <span class="block text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-1 text-glow">Olá, ${userName}</span>
                            <span class="block text-lg md:text-xl text-blue-200 font-medium tracking-wide opacity-90">Bem-vindo ao Prime Analytics</span>
                        `;
                    }

                    if (!isAppReady) {
                        telaLoading.classList.add('hidden');
                        carregarDadosDoSupabase(supabaseClient);
                    }
                } else {
                    // Profile not approved - Enforce Block
                    telaLoading.classList.add('hidden');
                    telaPendente.classList.remove('hidden');

                    // Update Pending Message based on specific status
                    const statusMsg = document.getElementById('pendente-status-msg');
                    if (statusMsg) {
                        if (profile && profile.status === 'bloqueado') {
                            statusMsg.textContent = "Acesso Bloqueado pelo Administrador";
                            statusMsg.style.color = "#e53e3e"; // Red
                        } else {
                            statusMsg.textContent = "Aguardando Liberação";
                            statusMsg.style.color = "#FF9933"; // Orange
                        }
                    }

                    // Hide dashboard content just in case
                    const contentWrapper = document.getElementById('content-wrapper');
                    if(contentWrapper) contentWrapper.classList.add('hidden');
                }
            } catch (err) {
                console.error("Error checking profile:", err);

                // If App is Ready (Silent Check), suppress error screen.
                if (isAppReady) {
                    console.warn("Background profile check failed. Keeping session active.");
                } else {
                    // Initial Load Failed - Show Error Screen
                    const card = document.getElementById('loading-card-content');
                    if (card) {
                        card.innerHTML = `
                            <h2 style="margin-top: 0; font-size: 1.5rem; font-weight: 600; color: #fc8181;">Erro de Conexão</h2>
                            <p style="color: #a0aec0; margin-bottom: 1.5rem;">${err.message || 'Não foi possível verificar suas credenciais.'}</p>
                            <button id="retry-connection-btn" class="gatekeeper-btn" style="background-color: #2d3748; border-color: #4a5568;">
                                Tentar Novamente
                            </button>
                            <p style="color: #4a5568; font-size: 0.75rem; margin-top: 1rem;">vServer 2.0</p>
                        `;
                        // Re-bind retry button
                        const retryBtn = document.getElementById('retry-connection-btn');
                        if(retryBtn) {
                            retryBtn.addEventListener('click', () => {
                                isCheckingProfile = false; // Reset flag to allow retry
                                verifyUserProfile(session);
                            });
                        }
                    } else {
                        alert("Erro de conexão: " + err.message);
                        telaLoading.classList.add('hidden');
                        telaPendente.classList.remove('hidden');
                    }
                }
            } finally {
                isCheckingProfile = false;
            }
        }

        // Visibility Change Listener for Reconnection
        document.addEventListener('visibilitychange', async () => {
            if (document.visibilityState === 'visible') {
                const errorCard = document.getElementById('loading-card-content');
                if (errorCard && errorCard.innerHTML.includes('Erro de Conexão')) {
                    const { data } = await supabaseClient.auth.getSession();
                    if (data && data.session) {
                        isCheckingProfile = false;
                        verifyUserProfile(data.session);
                    } else {
                        window.location.reload();
                    }
                }
            }
        });

        // Auth State Listener
        supabaseClient.auth.onAuthStateChange(async (event, session) => {
            if (session) {
                verifyUserProfile(session);
            } else {
                telaLogin.classList.remove('hidden');
            }
        });

        // Save Goals Logic
        const saveBtn = document.getElementById('save-goals-btn');
        const clearBtn = document.getElementById('clear-goals-btn');

        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                if (window.userRole !== 'adm') {
                    alert('Apenas usuários com permissão "adm" podem salvar metas.');
                    return;
                }

                const statusText = document.getElementById('save-goals-btn');
                const originalText = statusText.innerHTML;
                statusText.disabled = true;
                statusText.innerHTML = 'Salvando...';

                try {
                    const { data: { session } } = await supabaseClient.auth.getSession();
                    if (!session) {
                        throw new Error('Usuário não autenticado.');
                    }
                    await saveGoalsToSupabase(session.access_token);
                } catch (error) {
                    console.error(error);
                    alert('Erro ao salvar metas: ' + error.message);
                } finally {
                    statusText.disabled = false;
                    statusText.innerHTML = originalText;
                }
            });
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', async () => {
                if (window.userRole !== 'adm') {
                    alert('Apenas usuários com permissão "adm" podem apagar metas.');
                    return;
                }

                try {
                    const { data: { session } } = await supabaseClient.auth.getSession();
                    if (!session) {
                        throw new Error('Usuário não autenticado.');
                    }
                    await clearGoalsFromSupabase(session.access_token);
                } catch (error) {
                    console.error(error);
                    alert('Erro ao limpar metas: ' + error.message);
                }
            });
        }

        async function saveGoalsToSupabase(authToken) {
            const globalClientGoals = window.globalClientGoals;
            const goalsTargets = window.goalsTargets;

            if (typeof globalClientGoals === 'undefined' || !globalClientGoals) {
                throw new Error('Dados de metas não disponíveis (globalClientGoals undefined).');
            }

            const monthKey = new Date().toISOString().slice(0, 7);

            const goalsObj = {};
            globalClientGoals.forEach((val, key) => {
                goalsObj[key] = Object.fromEntries(val);
            });

            let sellerTargetsObj = {};
            const targetsMap = (typeof goalsSellerTargets !== 'undefined') ? goalsSellerTargets : (window.goalsSellerTargets || new Map());

            targetsMap.forEach((val, key) => {
                sellerTargetsObj[key] = val;
            });

            const payload = {
                month_key: monthKey,
                supplier: 'ALL',
                brand: 'GENERAL',
                goals_data: {
                    clients: goalsObj,
                    targets: goalsTargets,
                    seller_targets: sellerTargetsObj
                },
                updated_at: new Date().toISOString()
            };

            const response = await fetch(`${SUPABASE_URL}/rest/v1/goals_distribution?on_conflict=month_key,supplier,brand`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'resolution=merge-duplicates'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Erro Supabase (${response.status}): ${errorText}`);
            }

            alert('Metas salvas com sucesso!');
        }

        async function clearGoalsFromSupabase(authToken) {
            const btn = document.getElementById('clear-goals-btn');
            const originalText = btn.innerHTML;
            btn.innerHTML = 'Limpando...';
            btn.disabled = true;

            const monthKey = new Date().toISOString().slice(0, 7);

            try {
                const response = await fetch(`${SUPABASE_URL}/rest/v1/goals_distribution?month_key=eq.${monthKey}&supplier=eq.ALL&brand=eq.GENERAL`, {
                    method: 'DELETE',
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${authToken}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Erro ao limpar metas (${response.status}): ${errorText}`);
                }

                if(typeof globalClientGoals !== 'undefined') globalClientGoals.clear();
                if(typeof goalsTargets !== 'undefined') {
                    for(let k in goalsTargets) goalsTargets[k] = { fat: 0, vol: 0 };
                }

                const elFat = document.getElementById('goal-global-fat');
                const elVol = document.getElementById('goal-global-vol');
                const elMix = document.getElementById('goal-global-mix');
                const elMixSalty = document.getElementById('goal-global-mix-salty');
                const elMixFoods = document.getElementById('goal-global-mix-foods');

                if(elFat) elFat.value = '0,00';
                if(elVol) elVol.value = '0,000';
                if(elMix) elMix.value = '0';
                if(elMixSalty) elMixSalty.value = '0';
                if(elMixFoods) elMixFoods.value = '0';

                document.dispatchEvent(new CustomEvent('goalsCleared'));

                alert('Metas limpas com sucesso!');
            } catch (err) {
                console.error('Erro ao limpar metas:', err);
                alert('Erro ao limpar metas: ' + err.message);
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        }
    });

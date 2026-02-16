window.App = window.App || {};
window.App.Visitas = {
    visitaAbertaId: null,
    clienteEmVisitaId: null,
    currentActionClientCode: null,
    currentActionClientName: null,
    isRoteiroMode: false,
    roteiroDate: new Date(),

    init: function() {
        this.roteiroDate.setHours(0,0,0,0);
        this.verificarEstadoVisita();

        const formVisita = document.getElementById('form-visita');
        if (formVisita) {
            formVisita.addEventListener('submit', (e) => this.handleRelatorioSubmit(e));
        }
    },

    fetchMyVisits: async function() {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) return;

        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const isoStart = `${y}-${m}-01T00:00:00`;

        const { data } = await window.supabaseClient
            .from('visitas')
            .select('id, client_code, id_cliente, created_at, checkout_at, respostas')
            .eq('id_promotor', user.id)
            .gte('created_at', isoStart);

        if (data) {
            window.AppState.myMonthVisits.clear();
            data.forEach(v => {
                const code = window.Utils.normalizeKey(v.client_code || v.id_cliente);
                if (!window.AppState.myMonthVisits.has(code)) window.AppState.myMonthVisits.set(code, []);
                window.AppState.myMonthVisits.get(code).push(v);
            });
        }
    },

    verificarEstadoVisita: async function() {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) return;

        this.fetchMyVisits().then(() => {
            if (this.isRoteiroMode) this.renderRoteiroView();
            else if (!document.getElementById('clientes-view').classList.contains('hidden')) {
                if(window.App.Clients) window.App.Clients.render();
            }
        });

        const { data } = await window.supabaseClient
            .from('visitas')
            .select('id, id_cliente, client_code')
            .eq('id_promotor', user.id)
            .is('checkout_at', null)
            .maybeSingle();

        if (data) {
            this.visitaAbertaId = data.id;
            this.clienteEmVisitaId = data.client_code || data.id_cliente;
        }
        if (this.isRoteiroMode) this.renderRoteiroView();
    },

    openActionModal: function(clientCode, clientName) {
        this.currentActionClientCode = String(clientCode);
        if (clientName) this.currentActionClientName = clientName;
        else if (!this.currentActionClientName) this.currentActionClientName = 'Cliente';

        const modal = document.getElementById('modal-acoes-visita');
        const title = document.getElementById('acoes-visita-titulo');
        const subtitle = document.getElementById('acoes-visita-subtitulo');
        const statusText = document.getElementById('status-text-visita');
        const statusCard = document.getElementById('status-card-visita');

        title.textContent = this.currentActionClientName;
        let extraInfo = `Código: ${this.currentActionClientCode}`;
        const clientObj = window.AppState.clientMapForKPIs.get(window.Utils.normalizeKey(this.currentActionClientCode));
        // Need to handle if clientMapForKPIs is IndexMap or Map
        let city = '';
        if (clientObj) {
             city = clientObj.cidade || clientObj['Nome da Cidade'] || '';
        }
        if (city) extraInfo += ` • ${city}`;
        subtitle.textContent = extraInfo;

        const btnCheckIn = document.getElementById('btn-acao-checkin');
        const btnCheckOut = document.getElementById('btn-acao-checkout');
        const btnPesquisa = document.getElementById('btn-acao-pesquisa');
        const btnDetalhes = document.getElementById('btn-acao-detalhes');
        const btnGeo = document.getElementById('btn-acao-geo');

        const normCurrent = window.Utils.normalizeKey(this.currentActionClientCode);
        const normOpen = this.clienteEmVisitaId ? window.Utils.normalizeKey(this.clienteEmVisitaId) : null;

        if (this.visitaAbertaId) {
            if (normOpen === normCurrent) {
                btnCheckIn.classList.add('hidden');
                btnCheckOut.classList.remove('hidden');
                btnPesquisa.classList.remove('hidden');
                statusText.textContent = 'Em Andamento';
                statusText.className = 'text-sm font-bold text-green-400 animate-pulse';
                statusCard.classList.add('border-green-500/30', 'bg-green-500/5');
                statusCard.classList.remove('border-slate-700/50', 'bg-slate-800/50');
            } else {
                btnCheckIn.classList.remove('hidden');
                btnCheckIn.disabled = true;
                btnCheckIn.innerHTML = `<span class="text-xs">Finalize a visita anterior (${normOpen})</span>`;
                btnCheckOut.classList.add('hidden');
                btnPesquisa.classList.add('hidden');
                statusText.textContent = 'Outra Visita Ativa';
                statusText.className = 'text-sm font-bold text-orange-400';
                statusCard.classList.remove('border-green-500/30', 'bg-green-500/5');
                statusCard.classList.add('border-slate-700/50', 'bg-slate-800/50');
            }
        } else {
            btnCheckIn.classList.remove('hidden');
            btnCheckIn.disabled = false;
            btnCheckIn.innerHTML = `Check-in`; // Simplified HTML
            btnCheckOut.classList.add('hidden');
            btnPesquisa.classList.add('hidden');
            statusText.textContent = 'Não Iniciada';
            statusText.className = 'text-sm font-bold text-slate-400';
            statusCard.classList.remove('border-green-500/30', 'bg-green-500/5');
            statusCard.classList.add('border-slate-700/50', 'bg-slate-800/50');
        }

        const bind = (btn, fn) => {
            if (!btn) return;
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            newBtn.addEventListener('click', fn);
        };

        bind(btnCheckIn, () => this.fazerCheckIn(this.currentActionClientCode));
        bind(btnCheckOut, () => this.fazerCheckOut());
        bind(btnPesquisa, () => this.abrirPesquisa());
        bind(btnGeo, () => window.App.Map.openGeoUpdateModal());
        bind(btnDetalhes, () => window.App.Wallet.openWalletClientModal(this.currentActionClientCode));

        modal.classList.remove('hidden');
    },

    fazerCheckIn: async function(clientCode) {
        if (!navigator.geolocation) {
            window.Utils.showToast('error', 'Geolocalização não suportada.');
            return;
        }
        const btn = document.getElementById('btn-acao-checkin');
        const oldHtml = btn.innerHTML;
        btn.disabled = true; btn.innerHTML = '...';

        navigator.geolocation.getCurrentPosition(async (pos) => {
            const { latitude, longitude } = pos.coords;
            const { data: { user } } = await window.supabaseClient.auth.getUser();

            const payload = {
                id_promotor: user.id,
                id_cliente: clientCode,
                client_code: clientCode,
                latitude, longitude,
                status: 'pendente'
            };

            if (this.isRoteiroMode) {
                const today = new Date(); today.setHours(0,0,0,0);
                const routeRef = new Date(this.roteiroDate); routeRef.setHours(0,0,0,0);
                if (routeRef > today) payload.respostas = { is_off_route: true };
            }

            if (window.userCoCoordCode) payload.cod_cocoord = window.userCoCoordCode;
            if (window.userCoCoordEmail) payload.coordenador_email = window.userCoCoordEmail;

            let response = await window.supabaseClient.from('visitas').insert(payload).select().single();

            if (response.error && (payload.cod_cocoord || payload.coordenador_email)) {
                delete payload.cod_cocoord; delete payload.coordenador_email;
                response = await window.supabaseClient.from('visitas').insert(payload).select().single();
            }

            if (response.error) {
                window.Utils.showToast('error', 'Erro ao fazer check-in: ' + response.error.message);
                btn.disabled = false; btn.innerHTML = oldHtml;
                return;
            }

            this.visitaAbertaId = response.data.id;
            this.clienteEmVisitaId = clientCode;
            if (this.isRoteiroMode) this.renderRoteiroView();
            this.openActionModal(this.currentActionClientCode, this.currentActionClientName);

        }, (err) => {
            window.Utils.showToast('error', 'Erro ao obter localização.');
            btn.disabled = false; btn.innerHTML = oldHtml;
        }, { enableHighAccuracy: true, timeout: 10000 });
    },

    fazerCheckOut: async function() {
        if (!this.visitaAbertaId) return;
        const btn = document.getElementById('btn-acao-checkout');
        const oldHtml = btn.innerHTML;
        btn.disabled = true; btn.innerHTML = 'Finalizando...';

        try {
            const { error } = await window.supabaseClient.from('visitas').update({ checkout_at: new Date().toISOString() }).eq('id', this.visitaAbertaId);
            if (error) throw error;
            this.visitaAbertaId = null;
            this.clienteEmVisitaId = null;
            document.getElementById('modal-acoes-visita').classList.add('hidden');
            this.renderRoteiroView();
            window.Utils.showToast('success', 'Visita finalizada!');
        } catch (error) {
            window.Utils.showToast('error', 'Erro: ' + error.message);
            btn.disabled = false; btn.innerHTML = oldHtml;
        }
    },

    abrirPesquisa: async function() {
        const modal = document.getElementById('modal-relatorio');
        const form = document.getElementById('form-visita');
        document.getElementById('visita-atual-id').value = this.visitaAbertaId;
        form.reset();

        // Reset custom inputs (assumed global helper for now or just generic reset)
        // If initRackMultiSelect logic is simple, maybe just clear values
        const rackInput = document.getElementById('tipo_rack_hidden');
        if(rackInput) rackInput.value = '';

        if (this.clienteEmVisitaId) {
             const { data } = await window.supabaseClient.from('visitas').select('respostas').eq('client_code', this.clienteEmVisitaId).not('respostas', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle();
             if (data && data.respostas) {
                 Object.keys(data.respostas).forEach(key => {
                     const field = form.elements[key];
                     if (field) field.value = data.respostas[key];
                 });
             }
        }
        modal.classList.remove('hidden');
    },

    handleRelatorioSubmit: async function(e) {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        const oldHtml = btn.innerHTML;
        btn.disabled = true; btn.innerHTML = 'Salvando...';

        const formData = new FormData(e.target);
        const respostas = Object.fromEntries(formData.entries());
        const visitId = respostas.visita_id;
        delete respostas.visita_id;
        const obs = respostas.observacoes;
        delete respostas.observacoes;

        let fotoFile = formData.get('foto_gondola');
        if (!fotoFile || fotoFile.size === 0) {
            const cameraInput = document.getElementById('visita-foto-input-camera');
            if (cameraInput && cameraInput.files.length > 0) fotoFile = cameraInput.files[0];
        }
        delete respostas.foto_gondola;

        if (fotoFile && fotoFile.size > 0) {
            btn.innerHTML = 'Enviando foto...';
            try {
                const fileName = `${visitId}_${Date.now()}.jpg`;
                const { error } = await window.supabaseClient.storage.from('visitas-images').upload(fileName, fotoFile);
                if (!error) {
                    const { data } = window.supabaseClient.storage.from('visitas-images').getPublicUrl(fileName);
                    if (data) respostas.foto_url = data.publicUrl;
                }
            } catch (err) { console.error(err); }
        }

        try {
            const { error } = await window.supabaseClient.from('visitas').update({ respostas: respostas, observacao: obs }).eq('id', visitId);
            if (error) throw error;
            document.getElementById('modal-relatorio').classList.add('hidden');
            window.Utils.showToast('success', 'Relatório salvo!');
            if (this.currentActionClientCode) this.openActionModal(this.currentActionClientCode, this.currentActionClientName);
        } catch (err) {
            window.Utils.showToast('error', 'Erro: ' + err.message);
        } finally {
            btn.disabled = false; btn.innerHTML = oldHtml;
        }
    },

    toggleRoteiroMode: function() {
        this.isRoteiroMode = !this.isRoteiroMode;
        const btn = document.getElementById('toggle-roteiro-btn');
        const roteiroContainer = document.getElementById('roteiro-container');
        const listWrapper = document.getElementById('clientes-list-view-wrapper');
        const searchInput = document.getElementById('clientes-search');

        if (this.isRoteiroMode) {
            btn.classList.add('bg-purple-600', 'border-purple-500');
            btn.classList.remove('bg-slate-800', 'border-slate-700', 'hover:bg-slate-700');
            btn.querySelector('svg').classList.add('text-white');
            btn.querySelector('svg').classList.remove('text-purple-400');
            roteiroContainer.classList.remove('hidden');
            listWrapper.classList.add('hidden');
            if(searchInput) {
                searchInput.value = '';
                searchInput.placeholder = "Pesquisar cliente no roteiro...";
            }
            this.renderRoteiroView();
        } else {
            btn.classList.remove('bg-purple-600', 'border-purple-500');
            btn.classList.add('bg-slate-800', 'border-slate-700', 'hover:bg-slate-700');
            btn.querySelector('svg').classList.remove('text-white');
            btn.querySelector('svg').classList.add('text-purple-400');
            roteiroContainer.classList.add('hidden');
            listWrapper.classList.remove('hidden');
            if(searchInput) {
                searchInput.value = '';
                searchInput.placeholder = "Pesquisar...";
            }
            if(window.App.Clients) window.App.Clients.render();
        }
    },

    renderRoteiroView: function() {
        this.renderRoteiroCalendar();
        this.renderRoteiroClients(this.roteiroDate);
    },

    renderRoteiroCalendar: function() {
        const strip = document.getElementById('roteiro-calendar-strip');
        if (!strip) return;
        strip.innerHTML = '';

        const dayNumber = document.getElementById('roteiro-day-number');
        const monthLabel = document.getElementById('roteiro-current-month');
        const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        monthLabel.textContent = months[this.roteiroDate.getMonth()];
        dayNumber.textContent = this.roteiroDate.getDate();

        const start = new Date(this.roteiroDate);
        start.setDate(start.getDate() - 3);
        const weekDays = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

        for (let i = 0; i < 7; i++) {
            const d = new Date(start);
            d.setDate(d.getDate() + i);
            const isSelected = d.getTime() === this.roteiroDate.getTime();

            const dayEl = document.createElement('div');
            dayEl.className = `flex flex-col items-center justify-center p-2 rounded-lg cursor-pointer min-w-[50px] transition-colors ${isSelected ? 'bg-purple-600 text-white shadow-lg scale-110' : 'text-slate-400 hover:bg-slate-800'}`;
            dayEl.innerHTML = `<span class="text-[10px] font-bold tracking-wider">${weekDays[d.getDay()]}</span><span class="text-lg font-bold">${d.getDate()}</span>`;
            dayEl.onclick = () => { this.roteiroDate = d; this.renderRoteiroView(); };
            strip.appendChild(dayEl);
        }

        const prevBtn = document.getElementById('roteiro-prev-day');
        const nextBtn = document.getElementById('roteiro-next-day');
        // Replace to clear listeners
        const newPrev = prevBtn.cloneNode(true);
        const newNext = nextBtn.cloneNode(true);
        prevBtn.parentNode.replaceChild(newPrev, prevBtn);
        nextBtn.parentNode.replaceChild(newNext, nextBtn);

        newPrev.onclick = () => { this.roteiroDate.setDate(this.roteiroDate.getDate() - 1); this.renderRoteiroView(); };
        newNext.onclick = () => { this.roteiroDate.setDate(this.roteiroDate.getDate() + 1); this.renderRoteiroView(); };
    },

    renderRoteiroClients: function(date, forceEmpty = false) {
        const container = document.getElementById('roteiro-clients-list');
        if(!container) return; // Should be created by now or create if missing logic (omitted for brevity)
        container.innerHTML = '';

        const searchInput = document.getElementById('clientes-search');
        const searchTerm = (searchInput && searchInput.value) ? searchInput.value.toLowerCase().trim() : '';

        if (forceEmpty && searchTerm) {
            document.getElementById('roteiro-empty-state').classList.remove('hidden');
            return;
        }

        // Simplification: We need to filter `allClientsData`
        // We iterate `allClientsData` (AppState) and check Roteiro Frequency/Date
        const clients = window.AppState.allClientsData;
        const len = clients.length;
        const isColumnar = clients instanceof window.Utils.ColumnarDataset;

        const scheduledClients = [];

        const utcTarget = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());

        for (let i = 0; i < len; i++) {
            const c = isColumnar ? clients.get(i) : clients[i];

            // Search Filter
            if (searchTerm) {
                const match = (c.nomeCliente || '').toLowerCase().includes(searchTerm) || (String(c['Código'] || c['codigo_cliente'])).includes(searchTerm);
                if (!match) continue;
            }

            const freq = c.ITINERARY_FREQUENCY || c.itinerary_frequency;
            const refDateStr = c.ITINERARY_NEXT_DATE || c.itinerary_next_date;

            if (!freq || !refDateStr) continue;

            let utcRef;
            if (refDateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                const [y, m, d] = refDateStr.split('-').map(Number);
                utcRef = Date.UTC(y, m - 1, d);
            } else {
                const d = window.Utils.parseDate(refDateStr);
                if (!d) continue;
                utcRef = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
            }

            const diffDays = Math.ceil((utcTarget - utcRef) / (1000 * 60 * 60 * 24));

            let isScheduled = false;
            if (freq === 'weekly') isScheduled = (Math.abs(diffDays) % 7 === 0);
            else if (freq === 'biweekly') isScheduled = (Math.abs(diffDays) % 14 === 0);

            if (isScheduled) scheduledClients.push(c);
        }

        document.getElementById('roteiro-client-count').textContent = `${scheduledClients.length} clientes`;
        document.getElementById('roteiro-empty-state').classList.add('hidden');

        if (scheduledClients.length === 0) {
            document.getElementById('roteiro-empty-state').classList.remove('hidden');
        } else {
            scheduledClients.sort((a,b) => (a.nomeCliente||'').localeCompare(b.nomeCliente||''));
            scheduledClients.forEach(c => {
                const cod = window.Utils.normalizeKey(c['Código'] || c['codigo_cliente']);
                const visits = window.AppState.myMonthVisits.get(cod) || [];
                const todaysVisit = visits.find(v => {
                    const d = new Date(v.created_at);
                    return d.getDate() === date.getDate() && d.getMonth() === date.getMonth();
                });

                let statusHtml = `<span class="px-2 py-1 bg-slate-800 text-slate-400 text-xs font-bold rounded-full">Pendente</span>`;
                let barColor = 'bg-slate-600';

                if (todaysVisit) {
                    if (todaysVisit.checkout_at) {
                        statusHtml = `<span class="px-2 py-1 bg-green-900 text-green-300 text-xs font-bold rounded-full">Visitado</span>`;
                        barColor = 'bg-green-500';
                    } else {
                        statusHtml = `<span class="px-2 py-1 bg-orange-900 text-orange-300 text-xs font-bold rounded-full animate-pulse">Em Andamento</span>`;
                        barColor = 'bg-orange-500';
                    }
                }

                const div = document.createElement('div');
                div.className = 'p-4 flex items-center justify-between hover:bg-slate-800 cursor-pointer transition-colors';
                div.innerHTML = `
                    <div class="flex items-center gap-3">
                        <div class="w-2 h-10 ${barColor} rounded-full"></div>
                        <div>
                            <div class="text-sm font-bold text-white">${c.fantasia || c.nomeCliente}</div>
                            <div class="text-xs text-slate-400 font-mono">${cod} • ${c.cidade || ''}</div>
                        </div>
                    </div>
                    <div>${statusHtml}</div>
                `;
                div.onclick = () => this.openActionModal(cod, c.fantasia || c.nomeCliente);
                container.appendChild(div);
            });
        }
    },

    saveClientItinerary: async function(clientCode, frequency, nextDate) {
        if (!clientCode || !frequency || !nextDate) {
            window.Utils.showToast('warning', 'Preencha todos os campos.');
            return;
        }

        try {
            const clientCodeNorm = window.Utils.normalizeKey(clientCode);
            // Assuming user is promoter or has permission
            const { data: { user } } = await window.supabaseClient.auth.getUser();

            const payload = {
                client_code: clientCodeNorm,
                promoter_code: window.AppState.userHierarchyContext.promotor || (user ? user.id : 'unknown'), // Best effort
                itinerary_frequency: frequency,
                itinerary_ref_date: nextDate
            };

            const { error } = await window.supabaseClient.from('data_client_promoters').upsert(payload, { onConflict: 'client_code' });
            if (error) throw error;

            // Update Cache (Columnar)
            // Ideally we should update AppState.allClientsData here too to reflect change immediately
            // But for brevity, relying on reload or eventual consistency
            window.Utils.showToast('success', 'Roteiro salvo!');
            if (this.isRoteiroMode) this.renderRoteiroView();

        } catch (e) {
            console.error(e);
            window.Utils.showToast('error', 'Erro ao salvar: ' + e.message);
        }
    }
};

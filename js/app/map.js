window.App = window.App || {};
window.App.Map = {
    leafletMap: null,
    heatLayer: null,
    clientMarkersLayer: null,
    nominatimQueue: [],
    isProcessingQueue: false,
    currentFilteredClients: [],
    currentFilteredSalesMap: new Map(),
    currentClientMixStatus: new Map(),
    areMarkersGenerated: false,
    cityMapJobId: 0,
    isCityMapCalculating: false,
    geoUpdateMap: null,
    geoUpdateMarker: null,
    currentGeoLat: null,
    currentGeoLng: null,

    initLeafletMap: function() {
        if (this.leafletMap) return;
        const mapContainer = document.getElementById('leaflet-map');
        if (!mapContainer) return;

        const defaultCenter = [-12.9714, -38.5014];
        this.leafletMap = L.map(mapContainer).setView(defaultCenter, 7);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(this.leafletMap);

        this.heatLayer = L.heatLayer([], {
            radius: 15, blur: 15, maxZoom: 10, minOpacity: 0.05, max: 20.0,
            gradient: { 0.2: 'rgba(0, 0, 255, 0.35)', 0.5: 'rgba(0, 255, 0, 0.35)', 1.0: 'rgba(255, 0, 0, 0.35)' }
        }).addTo(this.leafletMap);

        this.clientMarkersLayer = L.layerGroup();

        this.leafletMap.on('zoomend', () => {
            const zoom = this.leafletMap.getZoom();
            if (this.heatLayer) {
                if (zoom >= 14) {
                    if (this.leafletMap.hasLayer(this.heatLayer)) this.leafletMap.removeLayer(this.heatLayer);
                } else {
                    if (!this.leafletMap.hasLayer(this.heatLayer)) this.leafletMap.addLayer(this.heatLayer);
                    let newOptions = zoom >= 12 ? { radius: 12, blur: 12, max: 5.0, minOpacity: 0.2 } : { radius: 15, blur: 15, max: 20.0, minOpacity: 0.05 };
                    this.heatLayer.setOptions(newOptions);
                }
            }
            this.updateMarkersVisibility();
        });
    },

    updateCityMap: async function(clients, sales) {
        const cityMapContainer = document.getElementById('city-map-container');
        if (!this.leafletMap || (cityMapContainer && cityMapContainer.classList.contains('hidden'))) return;
        if (!clients || clients.length === 0) return;

        const jobId = ++this.cityMapJobId;
        this.isCityMapCalculating = true;
        this.currentFilteredClients = clients;
        this.areMarkersGenerated = false;
        if (this.clientMarkersLayer) this.clientMarkersLayer.clearLayers();

        const heatData = [];
        const validBounds = [];
        const coordsMap = window.AppState.clientCoordinatesMap;

        clients.forEach(client => {
            const codCli = window.Utils.normalizeKey(client['Código'] || client['codigo_cliente']);
            const coords = coordsMap.get(codCli);
            if (coords) {
                heatData.push([coords.lat, coords.lng, 1.0]);
                validBounds.push([coords.lat, coords.lng]);
            }
        });

        if (this.heatLayer) this.heatLayer.setLatLngs(heatData);
        if (validBounds.length > 0) this.leafletMap.fitBounds(validBounds);

        const tempSalesMap = new Map();
        const tempMixStatus = new Map();

        if (sales) {
            window.Utils.runAsyncChunked(sales, (s) => {
                const cod = s.CODCLI;
                const val = Number(s.VLVENDA) || 0;
                tempSalesMap.set(cod, (tempSalesMap.get(cod) || 0) + val);

                let mix = tempMixStatus.get(cod);
                if (!mix) {
                    mix = { elma: false, foods: false };
                    tempMixStatus.set(cod, mix);
                }
                const codFor = String(s.CODFOR);
                if (['707', '708', '752'].includes(codFor)) mix.elma = true;
                else if (codFor === '1119') mix.foods = true;
            }, () => {
                if (jobId !== this.cityMapJobId) return;
                this.currentFilteredSalesMap = tempSalesMap;
                this.currentClientMixStatus = tempMixStatus;
                this.areMarkersGenerated = false;
                this.isCityMapCalculating = false;
                this.updateMarkersVisibility();
            }, () => jobId !== this.cityMapJobId);
        } else {
            if (jobId === this.cityMapJobId) {
                this.currentFilteredSalesMap = new Map();
                this.currentClientMixStatus = new Map();
                this.areMarkersGenerated = false;
                this.isCityMapCalculating = false;
                this.updateMarkersVisibility();
            }
        }
    },

    updateMarkersVisibility: function() {
        if (!this.leafletMap || !this.clientMarkersLayer) return;
        const zoom = this.leafletMap.getZoom();
        if (zoom >= 14) {
            if (!this.areMarkersGenerated) {
                this.generateMarkersAsync();
            } else {
                if (!this.leafletMap.hasLayer(this.clientMarkersLayer)) this.leafletMap.addLayer(this.clientMarkersLayer);
            }
        } else {
            if (this.leafletMap.hasLayer(this.clientMarkersLayer)) this.leafletMap.removeLayer(this.clientMarkersLayer);
        }
    },

    generateMarkersAsync: function() {
        if (this.areMarkersGenerated || this.isCityMapCalculating) return;
        const clientsToProcess = this.currentFilteredClients;
        const coordsMap = window.AppState.clientCoordinatesMap;

        window.Utils.runAsyncChunked(clientsToProcess, (client) => {
            const codCli = window.Utils.normalizeKey(client['Código'] || client['codigo_cliente']);
            const coords = coordsMap.get(codCli);

            if (coords) {
                const val = this.currentFilteredSalesMap.get(codCli) || 0;
                const formattedVal = val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                const rcaCode = client.rca1 || 'N/A';
                const rcaName = window.AppState.optimizedData.rcaNameByCode.get(rcaCode) || rcaCode;

                let markerColor = '#ef4444';
                let statusText = 'Não comprou';

                if (val > 0) {
                    const mix = this.currentClientMixStatus.get(codCli) || { elma: false, foods: false };
                    if (mix.elma && mix.foods) { markerColor = '#3b82f6'; statusText = 'Comprou Elma e Foods'; }
                    else if (mix.elma) { markerColor = '#22c55e'; statusText = 'Apenas Elma'; }
                    else if (mix.foods) { markerColor = '#eab308'; statusText = 'Apenas Foods'; }
                    else { markerColor = '#9ca3af'; statusText = 'Outros'; }
                }

                const tooltipContent = `
                    <div class="text-xs">
                        <b>${codCli} - ${client.nomeCliente || 'Cliente'}</b><br>
                        <span class="text-blue-500 font-semibold">RCA: ${rcaName}</span><br>
                        <span class="text-green-600 font-bold">Venda: ${formattedVal}</span><br>
                        <span style="color: ${markerColor}; font-weight: bold;">Status: ${statusText}</span><br>
                        ${client.bairro || ''}, ${client.cidade || ''}
                    </div>
                `;

                const svgIcon = L.divIcon({
                    className: 'bg-transparent border-0',
                    html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="30" height="40" fill="${markerColor}" stroke="white" stroke-width="1.5" style="filter: drop-shadow(0px 2px 2px rgba(0,0,0,0.3));"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5" fill="white"/></svg>`,
                    iconSize: [30, 40], iconAnchor: [15, 40], tooltipAnchor: [0, -35]
                });

                const marker = L.marker([coords.lat, coords.lng], { icon: svgIcon, opacity: 1 });
                marker.bindTooltip(tooltipContent, { direction: 'top', offset: [0, 0] });
                this.clientMarkersLayer.addLayer(marker);
            }
        }, () => {
            this.areMarkersGenerated = true;
            this.updateMarkersVisibility();
        });
    },

    saveCoordinateToSupabase: async function(clientCode, lat, lng, address) {
        if (window.AppState.userHierarchyContext.role !== 'adm') return;
        try {
            const { error } = await window.supabaseClient.from('data_client_coordinates').upsert({
                client_code: String(clientCode), lat, lng, address
            });
            if (!error) {
                window.AppState.clientCoordinatesMap.set(String(clientCode), { lat, lng, address });
            }
        } catch (e) { console.error(e); }
    },

    geocodeAddressNominatim: async function(address) {
        if (!address) return null;
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`, {
                headers: { 'User-Agent': 'PrimeDashboardApp/1.0' }
            });
            if (!response.ok) return null;
            const data = await response.json();
            if (data && data.length > 0) {
                return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), formatted_address: data[0].display_name };
            }
        } catch (e) { console.warn(e); }
        return null;
    },

    buildAddress: function(client, level) {
        const endereco = client['Endereço Comercial'] || client.endereco || client.ENDERECO || '';
        const numero = client.numero || client.NUMERO || '';
        const bairro = client.bairro || client.BAIRRO || '';
        const cidade = client.cidade || client.CIDADE || '';
        const nome = client.nomeCliente || client.nome || '';
        const isValid = (s) => s && s !== 'N/A' && s !== '0' && String(s).toUpperCase() !== 'S/N' && String(s).trim() !== '';
        const parts = [];

        if (level === 0) {
            if(isValid(nome)) parts.push(nome);
            if(isValid(bairro)) parts.push(bairro);
            if(isValid(cidade)) parts.push(cidade);
        } else if (level === 1) {
            if(isValid(endereco)) parts.push(endereco);
            if(isValid(numero)) parts.push(numero);
            if(isValid(bairro)) parts.push(bairro);
            if(isValid(cidade)) parts.push(cidade);
        } else if (level === 2) {
            if(isValid(endereco)) parts.push(endereco);
            if(isValid(bairro)) parts.push(bairro);
            if(isValid(cidade)) parts.push(cidade);
        } else if (level === 3) {
            if(isValid(bairro)) parts.push(bairro);
            if(isValid(cidade)) parts.push(cidade);
        } else if (level === 4) {
            if(isValid(cidade)) parts.push(cidade);
        }

        if (parts.length === 0) return null;
        parts.push("Bahia");
        parts.push("Brasil");
        return parts.join(', ');
    },

    processNominatimQueue: function() {
        if (this.isProcessingQueue || this.nominatimQueue.length === 0) return;
        this.isProcessingQueue = true;

        const processNext = async () => {
            if (this.nominatimQueue.length === 0) {
                this.isProcessingQueue = false;
                console.log("[GeoSync] Fila finalizada.");
                return;
            }

            const item = this.nominatimQueue.shift();
            const client = item.client;
            let level = item.level !== undefined ? item.level : 0;
            let address = item.address;

            if (!address) {
                address = this.buildAddress(client, level);
                if (!address && level < 4) {
                    this.nominatimQueue.unshift({ client, level: level + 1 });
                    setTimeout(processNext, 0); return;
                }
            }

            if (!address) { setTimeout(processNext, 100); return; }

            try {
                const result = await this.geocodeAddressNominatim(address);
                if (result) {
                    const codCli = String(client['Código'] || client['codigo_cliente']);
                    await this.saveCoordinateToSupabase(codCli, result.lat, result.lng, result.formatted_address);
                    if (this.heatLayer && this.heatLayer._map) this.heatLayer.addLatLng([result.lat, result.lng, 1]);
                } else {
                    if (level < 4) this.nominatimQueue.unshift({ client, level: level + 1 });
                }
            } catch (e) { console.error(e); }

            setTimeout(processNext, 1200);
        };
        processNext();
    },

    syncGlobalCoordinates: async function() {
        if (window.AppState.userHierarchyContext.role !== 'adm') return;
        console.log("[GeoSync] Iniciando verificação...");

        const activeClientsList = window.App.Filters.getActiveClientsData();
        const activeClientCodes = new Set();
        activeClientsList.forEach(c => activeClientCodes.add(String(c['Código'] || c['codigo_cliente'])));

        // Cleanup Orphans
        const orphanedCodes = [];
        window.AppState.clientCoordinatesMap.forEach((v, code) => {
            if (!activeClientCodes.has(code)) orphanedCodes.push(code);
        });

        if (orphanedCodes.length > 0) {
            const { error } = await window.supabaseClient.from('data_client_coordinates').delete().in('client_code', orphanedCodes);
            if (!error) orphanedCodes.forEach(c => window.AppState.clientCoordinatesMap.delete(c));
        }

        // Queue Missing
        const queuedCodes = new Set();
        this.nominatimQueue.forEach(i => queuedCodes.add(String(i.client['Código'] || i.client['codigo_cliente'])));

        activeClientsList.forEach(client => {
            const code = String(client['Código'] || client['codigo_cliente']);
            if (window.AppState.clientCoordinatesMap.has(code)) return;

            const cep = client.cep || client.CEP || '';
            const cleanCep = cep.replace(/\D/g, '');
            const cepVal = parseInt(cleanCep);
            const isBahia = !isNaN(cepVal) && cepVal >= 40000000 && cepVal <= 48999999;

            if (!isBahia) return;

            if (!queuedCodes.has(code)) {
                this.nominatimQueue.push({ client, level: 0 });
                queuedCodes.add(code);
            }
        });

        if (this.nominatimQueue.length > 0) this.processNominatimQueue();
    },

    openGeoUpdateModal: function() {
        const modal = document.getElementById('modal-geo-update');
        const loading = document.getElementById('geo-update-loading');
        modal.classList.remove('hidden');
        loading.classList.remove('hidden');

        if (!navigator.geolocation) {
            window.Utils.showToast('error', "Geolocalização não suportada.");
            modal.classList.add('hidden');
            return;
        }

        navigator.geolocation.getCurrentPosition((pos) => {
            const { latitude, longitude } = pos.coords;
            this.currentGeoLat = latitude;
            this.currentGeoLng = longitude;
            loading.classList.add('hidden');

            if (!this.geoUpdateMap) {
                this.geoUpdateMap = L.map('geo-update-map').setView([latitude, longitude], 16);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(this.geoUpdateMap);
            } else {
                this.geoUpdateMap.invalidateSize();
                this.geoUpdateMap.setView([latitude, longitude], 16);
            }

            if (this.geoUpdateMarker) this.geoUpdateMap.removeLayer(this.geoUpdateMarker);
            this.geoUpdateMarker = L.marker([latitude, longitude], { draggable: true }).addTo(this.geoUpdateMap);

            this.geoUpdateMarker.on('dragend', (e) => {
                const pos = e.target.getLatLng();
                this.currentGeoLat = pos.lat;
                this.currentGeoLng = pos.lng;
            });
        }, (err) => {
            window.Utils.showToast('error', "Erro ao obter localização.");
            modal.classList.add('hidden');
        }, { enableHighAccuracy: true });

        const confirmBtn = document.getElementById('btn-confirm-geo-update');
        const newBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);

        newBtn.addEventListener('click', async () => {
            if (!this.currentGeoLat || !this.currentGeoLng || !window.App.Visitas.currentActionClientCode) return;
            const clientCode = window.App.Visitas.currentActionClientCode;
            const oldText = newBtn.innerHTML;
            newBtn.disabled = true; newBtn.innerHTML = 'Salvando...';

            try {
                await this.saveCoordinateToSupabase(clientCode, this.currentGeoLat, this.currentGeoLng, 'Atualizado Manualmente');
                if (this.heatLayer) this.heatLayer.addLatLng([this.currentGeoLat, this.currentGeoLng, 1]);
                window.Utils.showToast('success', 'Geolocalização atualizada!');
                modal.classList.add('hidden');
            } catch (e) {
                window.Utils.showToast('error', 'Erro ao salvar: ' + e.message);
            } finally {
                newBtn.disabled = false; newBtn.innerHTML = oldText;
            }
        });
    }
};

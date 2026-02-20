
            statusText.textContent = 'Não Iniciada';
            statusText.className = 'text-sm font-bold text-slate-400';
            statusCard.classList.remove('border-green-500/30', 'bg-green-500/5');
            statusCard.classList.add('border-slate-700/50', 'bg-glass');
        }

        // Bind Actions (Clean old listeners via cloning)
        const bind = (btn, fn) => {
            if (!btn) return;
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            newBtn.addEventListener('click', fn);
            return newBtn;
        };

        bind(btnCheckIn, () => fazerCheckIn(currentActionClientCode));
        bind(btnCheckOut, () => fazerCheckOut());
        bind(btnPesquisa, () => abrirPesquisa());
        bind(btnGeo, () => openGeoUpdateModal());
        bind(btnDetalhes, () => {
            // Keep Action Modal open in background to prevent blinking/state loss
            openWalletClientModal(currentActionClientCode);
        });

        modal.classList.remove('hidden');
    }

    async function fazerCheckIn(clientCode) {
        if (!navigator.geolocation) {
            window.showToast('error', 'Geolocalização não suportada.');
            return;
        }

        const btn = document.getElementById('btn-acao-checkin');
        const oldHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '...';

        navigator.geolocation.getCurrentPosition(async (pos) => {
            const { latitude, longitude } = pos.coords;
            const { data: { user } } = await window.supabaseClient.auth.getUser();

            if (!user) {
                window.showToast('error', 'Erro: Usuário não autenticado.');
                btn.disabled = false; btn.innerHTML = oldHtml;
                return;
            }

            // 1. Insert Visit
            const payload = {
                id_promotor: user.id,
                id_cliente: clientCode, // Text
                client_code: clientCode, // Text
                latitude,
                longitude,
                status: 'pendente'
            };

            // Determine if Off Route (Logic: Is Roteiro Mode AND Date > Today)
            // Note: roteiroDate is global
            if (typeof isRoteiroMode !== 'undefined' && isRoteiroMode) {
                const today = new Date(); today.setHours(0,0,0,0);
                const routeRef = new Date(roteiroDate); routeRef.setHours(0,0,0,0);

                if (routeRef > today) {
                    // Initialize respostas with the flag
                    payload.respostas = { is_off_route: true };
                }
            }

            // Include Co-Coordinator Code if available (From Init)
            if (window.userCoCoordCode) {
                payload.cod_cocoord = window.userCoCoordCode;
            }
            // Include Pre-Resolved Email if available (Frontend-First Strategy)
            if (window.userCoCoordEmail) {
                payload.coordenador_email = window.userCoCoordEmail;
            }

            let response = await window.supabaseClient.from('visitas').insert(payload).select().single();

            // Self-Healing: Fallback for ANY error if we sent new columns
            if (response.error && (payload.cod_cocoord || payload.coordenador_email)) {
                console.warn("[CheckIn] Error detected with new columns. Retrying purely...", response.error);
                delete payload.cod_cocoord;
                delete payload.coordenador_email;
                response = await window.supabaseClient.from('visitas').insert(payload).select().single();
            }

            if (response.error) {
                console.error(response.error);
                window.showToast('error', 'Erro ao fazer check-in: ' + response.error.message);
                btn.disabled = false; btn.innerHTML = oldHtml;
                return;
            }

            visitaAbertaId = response.data.id;
            clienteEmVisitaId = clientCode;

            // REFRESH UI (Keep Modal Open, Update State)
            if (isRoteiroMode) renderRoteiroView();
            openActionModal(currentActionClientCode, currentActionClientName); // Re-open/Refresh

        }, (err) => {
            console.error(err);
            window.showToast('error', 'Erro ao obter localização. Permita o acesso e tente novamente.');
            btn.disabled = false;
            btn.innerHTML = oldHtml;
        }, { enableHighAccuracy: true, timeout: 10000 });
    }

    // --- GEO UPDATE LOGIC ---
    let geoUpdateMap = null;
    let geoUpdateMarker = null;
    let currentGeoLat = null;
    let currentGeoLng = null;

    function openGeoUpdateModal() {
        // Keep Action Modal open in background
        const modal = document.getElementById('modal-geo-update');
        const loading = document.getElementById('geo-update-loading');

        modal.classList.remove('hidden');
        loading.classList.remove('hidden');

        if (!navigator.geolocation) {
            window.showToast('error', "Geolocalização não suportada.");
            modal.classList.add('hidden');
            return;
        }

        navigator.geolocation.getCurrentPosition((pos) => {
            const { latitude, longitude } = pos.coords;
            currentGeoLat = latitude;
            currentGeoLng = longitude;

            loading.classList.add('hidden');

            if (!geoUpdateMap) {
                geoUpdateMap = L.map('geo-update-map').setView([latitude, longitude], 16);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; OpenStreetMap'
                }).addTo(geoUpdateMap);
            } else {
                geoUpdateMap.invalidateSize(); // Fix render issues in modal
                geoUpdateMap.setView([latitude, longitude], 16);
            }

            if (geoUpdateMarker) geoUpdateMap.removeLayer(geoUpdateMarker);

            geoUpdateMarker = L.marker([latitude, longitude], { draggable: true }).addTo(geoUpdateMap);

            // Allow manual refinement
            geoUpdateMarker.on('dragend', function(e) {
                const pos = e.target.getLatLng();
                currentGeoLat = pos.lat;
                currentGeoLng = pos.lng;
            });

        }, (err) => {
            console.error(err);
            window.showToast('error', "Erro ao obter localização.");
            modal.classList.add('hidden');
        }, { enableHighAccuracy: true });

        // Bind Confirm Button
        const confirmBtn = document.getElementById('btn-confirm-geo-update');
        // Clean listeners
        const newBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);

        newBtn.addEventListener('click', async () => {
            if (!currentGeoLat || !currentGeoLng || !currentActionClientCode) return;

            const oldText = newBtn.innerHTML;
            newBtn.disabled = true;
            newBtn.innerHTML = 'Salvando...';

            try {
                const { error } = await window.supabaseClient
                    .from('data_client_coordinates')
                    .upsert({
                        client_code: currentActionClientCode,
                        lat: currentGeoLat,
                        lng: currentGeoLng,
                        updated_at: new Date().toISOString()
                    });

                if (error) throw error;

                // Update Local Cache
                clientCoordinatesMap.set(String(currentActionClientCode), {
                    lat: currentGeoLat,
                    lng: currentGeoLng,
                    address: 'Atualizado Manualmente'
                });

                // Update Visuals if needed (e.g. City Map if open)
                if (heatLayer) {
                    if (heatLayer._map) {
                        heatLayer.addLatLng([currentGeoLat, currentGeoLng, 1]);
                    } else {
                        heatLayer._latlngs.push([currentGeoLat, currentGeoLng, 1]);
                    }
                }

                window.showToast('success', 'Geolocalização atualizada com sucesso!');
                modal.classList.add('hidden');
            } catch (e) {
                console.error(e);
                window.showToast('error', 'Erro ao salvar: ' + e.message);
            } finally {
                newBtn.disabled = false;
                newBtn.innerHTML = oldText;
            }
        });
    }

    async function fazerCheckOut() {
        if (!visitaAbertaId) return;

        const btn = document.getElementById('btn-acao-checkout');
        const oldHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = 'Finalizando...';

        try {
            const { error } = await window.supabaseClient
                .from('visitas')
                .update({ checkout_at: new Date().toISOString() })
                .eq('id', visitaAbertaId);

            if (error) throw error;

            visitaAbertaId = null;
            clienteEmVisitaId = null;
            document.getElementById('modal-acoes-visita').classList.add('hidden');
            renderRoteiroView();
            window.showToast('success', 'Visita finalizada!');
        } catch (error) {
            console.error(error);
            window.showToast('error', 'Erro ao fazer check-out: ' + error.message);
        } finally {
            // Fix: Re-enable button on error and success
            btn.disabled = false;
            btn.innerHTML = oldHtml;
        }
    }

    async function abrirPesquisa() {
        // Keep Action Modal open in background
        const modal = document.getElementById('modal-relatorio');
        const form = document.getElementById('form-visita');
        document.getElementById('visita-atual-id').value = visitaAbertaId;

        // Reset form or load previous?
        // Plan says "Carregamos os dados da última visita".
        // Logic: Fetch LAST visit answers for THIS client.

        form.reset();
        resetRackMultiSelect();
        resetCustomFileInput();

        // Fetch last answers
        if (clienteEmVisitaId) {
             const { data } = await window.supabaseClient
                .from('visitas')
                .select('respostas')
                .eq('client_code', clienteEmVisitaId) // Use client_code
                .not('respostas', 'is', null)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

             if (data && data.respostas) {
                 Object.keys(data.respostas).forEach(key => {
                     if (key === 'tipo_rack') {
                         resetRackMultiSelect(data.respostas[key]);
                     } else {
                         const field = form.elements[key];
                         if (field) {
                             if (field instanceof RadioNodeList) field.value = data.respostas[key];
                             else field.value = data.respostas[key];
                         }
                     }
                 });
             }
        }

        modal.classList.remove('hidden');
    }

    // --- Navigation Helpers ---
    window.closeResearchModal = function() {
        document.getElementById('modal-relatorio').classList.add('hidden');
    }

    window.closeGeoModal = function() {
        document.getElementById('modal-geo-update').classList.add('hidden');
    }

    window.openMixMobileModal = function(codCli) {
        // Find client data
        const clientData = mixTableState.filteredData.find(c => c.codcli === String(codCli));
        if (!clientData) return;

        const modal = document.getElementById('mix-mobile-modal');
        const content = document.getElementById('mix-mobile-modal-content');
        const closeBtn = document.getElementById('mix-mobile-modal-close-btn');

        document.getElementById('mix-mobile-modal-title').textContent = clientData.name || clientData.razao;
        document.getElementById('mix-mobile-modal-subtitle').textContent = `Cód: ${clientData.codcli} • ${clientData.city}`;

        content.innerHTML = '';

        if (clientData.positivatedCount === 0) {
            content.innerHTML = '<div class="text-center text-slate-500 py-4">Nenhuma categoria positivada.</div>';
        } else {
            // Build list
            // clientData.categoryOrders is Map<Category, Set<OrderId>>
            const ordersMap = clientData.categoryOrders;
            const categories = [];

            if (ordersMap) {
                ordersMap.forEach((orders, cat) => {
                    categories.push({ name: cat, orders: Array.from(orders) });
                });
            }

            // Sort alphabetical
            categories.sort((a,b) => a.name.localeCompare(b.name));

            categories.forEach(c => {
                const item = document.createElement('div');
                item.className = 'glass-panel p-3 rounded-lg border border-slate-700/50';

                // Truncate list of orders if too long
                const orderList = c.orders.join(', ');

                item.innerHTML = `
                    <div class="flex justify-between items-start mb-1">
                        <span class="text-sm font-bold text-white">${c.name}</span>
                        <span class="text-xs font-bold text-green-400 bg-green-900/30 px-2 py-0.5 rounded-full">${c.orders.length} Pedido(s)</span>
                    </div>
                    <div class="text-[10px] text-slate-400 break-words">
                        PED: ${orderList}
                    </div>
                `;
                content.appendChild(item);
            });
        }

        modal.classList.remove('hidden');

        // Simple Close Binding
        closeBtn.onclick = () => {
            modal.classList.add('hidden');
        };

        // Close on outside click (Generic Modal Handler usually handles this, but ensuring specific behavior)
        modal.onclick = (e) => {
            if (e.target === modal) modal.classList.add('hidden');
        };
    };

    // Bind Form Submit
    const formVisita = document.getElementById('form-visita');
    if (formVisita) {
        formVisita.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            const oldHtml = btn.innerHTML;
            btn.disabled = true; btn.innerHTML = 'Salvando...';

            const formData = new FormData(e.target);
            const respostas = Object.fromEntries(formData.entries());

            // Remove internal fields if any
            const visitId = respostas.visita_id;
            delete respostas.visita_id;

            // Extract observation
            const obs = respostas.observacoes;
            delete respostas.observacoes; // Store obs separately in column

            // Handle Photo Upload
            // Check both inputs
            let fotoFile = formData.get('foto_gondola'); // From Gallery Input (name="foto_gondola")

            // Check Camera Input manually if main is empty
            if (!fotoFile || fotoFile.size === 0) {
                const cameraInput = document.getElementById('visita-foto-input-camera');
                if (cameraInput && cameraInput.files.length > 0) {
                    fotoFile = cameraInput.files[0];
                }
            }

            delete respostas.foto_gondola; // Remove file object from JSON

            let fotoUrl = null;

            if (fotoFile && fotoFile.size > 0) {
                btn.innerHTML = 'Enviando foto...';
                try {
                    const fileName = `${visitId}_${Date.now()}.jpg`;
                    const { data, error: uploadError } = await window.supabaseClient
                        .storage
                        .from('visitas-images')
                        .upload(fileName, fotoFile, {
                            cacheControl: '3600',
                            upsert: false
                        });

                    if (uploadError) {
                        console.error('Erro no upload:', uploadError);
                        // Don't block submission, just log error
                    } else {
                        const { data: publicUrlData } = window.supabaseClient
                            .storage
                            .from('visitas-images')
                            .getPublicUrl(fileName);

                        if (publicUrlData) {
                            fotoUrl = publicUrlData.publicUrl;
                            respostas.foto_url = fotoUrl; // Store URL in answers
                        }
                    }
                } catch (uploadErr) {
                    console.error('Exceção no upload:', uploadErr);
                }
            }

            btn.innerHTML = 'Salvando dados...';

            try {
                const { error } = await window.supabaseClient
                    .from('visitas')
                    .update({
                        respostas: respostas,
                        observacao: obs
                    })
                    .eq('id', visitId);

                if (error) throw error;

                document.getElementById('modal-relatorio').classList.add('hidden');
                window.showToast('success', 'Relatório salvo!');

                // Return to Action Menu
                if (currentActionClientCode) {
                    openActionModal(currentActionClientCode, currentActionClientName);
                }

            } catch (err) {
                window.showToast('error', 'Erro ao salvar: ' + err.message);
            } finally {
                btn.disabled = false; btn.innerHTML = oldHtml;
            }
        });
    }

    function renderWeeklyComparisonAmChart(weekLabels, currentData, historyData, isTendency) {
        // Dispose existing root (Robust Check)
        if (window.am5 && window.am5.registry && window.am5.registry.rootElements) {
             for (let i = window.am5.registry.rootElements.length - 1; i >= 0; i--) {
                 const r = window.am5.registry.rootElements[i];
                 if (r.dom && r.dom.id === "weeklyComparisonChartContainer") {
                     r.dispose();
                 }
             }
        }
        weeklyAmChartRoot = null;

        // Clean container (remove any canvas from Chart.js)
        const container = document.getElementById('weeklyComparisonChartContainer');
        if (!container) return;
        container.innerHTML = '';

        // amCharts 5 Logic
        if (!window.am5) {
            console.error("amCharts 5 not loaded");
            return;
        }

        const am5 = window.am5;
        const am5xy = window.am5xy;
        const am5themes_Animated = window.am5themes_Animated;
        const am5themes_Dark = window.am5themes_Dark;

        const root = am5.Root.new("weeklyComparisonChartContainer");
        weeklyAmChartRoot = root;

        if (root._logo) {
            root._logo.dispose();
        }

        root.setThemes([
            am5themes_Animated.new(root),
            am5themes_Dark.new(root)
        ]);

        const chart = root.container.children.push(
            am5xy.XYChart.new(root, {
                panX: true,
                panY: false,
                wheelX: "panX",
                wheelY: "zoomX",
                layout: root.verticalLayout
            })
        );

        // Prepare Data
        const data = weekLabels.map((label, i) => ({
            category: label,
            current: currentData[i] || 0,
            history: historyData[i] || 0
        }));

        // X Axis (Weeks)
        const xRenderer = am5xy.AxisRendererX.new(root, {
            minGridDistance: 30,
            minorGridEnabled: true
        });

        // Clean Look: Hide grid
        xRenderer.grid.template.set("forceHidden", true);

        const xAxis = chart.xAxes.push(
            am5xy.CategoryAxis.new(root, {
                categoryField: "category",
                renderer: xRenderer,
                tooltip: am5.Tooltip.new(root, {})
            })
        );
        xAxis.data.setAll(data);

        // Y Axis
        const yRenderer = am5xy.AxisRendererY.new(root, {});
        // Clean Look: Hide grid
        yRenderer.grid.template.set("forceHidden", true);

        const yAxis = chart.yAxes.push(
            am5xy.ValueAxis.new(root, {
                renderer: yRenderer
            })
        );

        // Series 1: Current (Column) - Indigo
        const series1 = chart.series.push(
            am5xy.ColumnSeries.new(root, {
                name: isTendency ? "Tendência Semanal" : "Mês Atual",
                xAxis: xAxis,
                yAxis: yAxis,
                valueYField: "current",
                categoryXField: "category",
                fill: am5.color(0x3f51b5),
                tooltip: am5.Tooltip.new(root, {
                    pointerOrientation: "horizontal",
                    labelText: "{name}: [bold]{valueY}[/]"
                })
            })
        );

        series1.columns.template.setAll({
            cornerRadiusTL: 5,
            cornerRadiusTR: 5,
            fillOpacity: 0.8,
            strokeWidth: 0
        });

        series1.data.setAll(data);

        // Series 2: History (Line) - Cyan
        const series2 = chart.series.push(
            am5xy.LineSeries.new(root, {
                name: "Média Trimestre",
                xAxis: xAxis,
                yAxis: yAxis,
                valueYField: "history",
                categoryXField: "category",
                stroke: am5.color(0x00e5ff),
                tooltip: am5.Tooltip.new(root, {
                    pointerOrientation: "horizontal",
                    labelText: "{name}: [bold]{valueY}[/]"
                })
            })
        );

        series2.strokes.template.setAll({
            strokeWidth: 3
        });

        series2.bullets.push(function () {
            return am5.Bullet.new(root, {
                sprite: am5.Circle.new(root, {
                    radius: 5,
                    fill: series2.get("stroke")
                })
            });
        });

        series2.data.setAll(data);

        // Cursor
        const cursor = chart.set("cursor", am5xy.XYCursor.new(root, {
            behavior: "zoomX"
        }));
        cursor.lineY.set("visible", false);

        // Legend
        const legend = chart.children.push(am5.Legend.new(root, {
            centerX: am5.p50,
            x: am5.p50
        }));
        legend.data.setAll(chart.series.values);

        // Animation
        series1.appear(1000, 100);
        series2.appear(1000, 100);
        chart.appear(1000, 100);
    }

    function renderMonthlyComparisonAmChart(labels, dataValues, labelName, colorHex) {
        // Dispose existing root (Robust Check)
        if (window.am5 && window.am5.registry && window.am5.registry.rootElements) {
             for (let i = window.am5.registry.rootElements.length - 1; i >= 0; i--) {
                 const r = window.am5.registry.rootElements[i];
                 if (r.dom && r.dom.id === "monthlyComparisonChartContainer") {
                     r.dispose();
                 }
             }
        }
        monthlyAmChartRoot = null;

        const container = document.getElementById('monthlyComparisonChartContainer');
        if (!container) return;
        container.innerHTML = '';

        if (!window.am5) return;

        const am5 = window.am5;
        const am5xy = window.am5xy;
        const am5themes_Animated = window.am5themes_Animated;
        const am5themes_Dark = window.am5themes_Dark;

        const root = am5.Root.new("monthlyComparisonChartContainer");
        monthlyAmChartRoot = root;

        if (root._logo) root._logo.dispose();

        root.setThemes([
            am5themes_Animated.new(root),
            am5themes_Dark.new(root)
        ]);

        const chart = root.container.children.push(
            am5xy.XYChart.new(root, {
                panX: true,
                panY: false,
                wheelX: "panX",
                wheelY: "zoomX",
                layout: root.verticalLayout
            })
        );

        const data = labels.map((l, i) => ({
            category: l,
            value: dataValues[i] || 0
        }));

        const xRenderer = am5xy.AxisRendererX.new(root, {
            minGridDistance: 30,
            minorGridEnabled: true
        });
        xRenderer.grid.template.set("forceHidden", true);

        const xAxis = chart.xAxes.push(
            am5xy.CategoryAxis.new(root, {
                categoryField: "category",
                renderer: xRenderer,
                tooltip: am5.Tooltip.new(root, {})
            })
        );
        xAxis.data.setAll(data);

        const yRenderer = am5xy.AxisRendererY.new(root, {});
        yRenderer.grid.template.set("forceHidden", true);

        const yAxis = chart.yAxes.push(
            am5xy.ValueAxis.new(root, {
                renderer: yRenderer
            })
        );

        const series = chart.series.push(
            am5xy.ColumnSeries.new(root, {
                name: labelName,
                xAxis: xAxis,
                yAxis: yAxis,
                valueYField: "value",
                categoryXField: "category",
                fill: am5.color(colorHex),
                tooltip: am5.Tooltip.new(root, {
                    labelText: "{categoryX}: [bold]{valueY}[/]"
                })
            })
        );

        series.columns.template.setAll({
            cornerRadiusTL: 5,
            cornerRadiusTR: 5,
            fillOpacity: 0.8,
            strokeWidth: 0
        });

        series.data.setAll(data);

        const cursor = chart.set("cursor", am5xy.XYCursor.new(root, {
            behavior: "zoomX"
        }));
        cursor.lineY.set("visible", false);

        series.appear(1000, 100);
        chart.appear(1000, 100);
    }

    function renderLiquidGauge(containerId, value, goal, label) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Clear previous content
        container.innerHTML = '';

        let percent = 0;
        if (goal > 0) {
            percent = (value / goal) * 100;
        } else if (value > 0) {
            percent = 100;
        }

        const clampedPercent = Math.min(Math.max(percent, 0), 100);
        const displayPercentage = Math.round(percent);

        const formattedValue = value.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL', maximumFractionDigits: 2, minimumFractionDigits: 2});
        const formattedGoal = goal.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL', maximumFractionDigits: 2, minimumFractionDigits: 2});

        const html = `
            <div class="flex flex-col justify-center w-full h-full px-2 md:px-6 py-2">
                <!-- Main Horizontal Bar -->
                <div class="relative w-full h-16 md:h-24 bg-gray-900/80 rounded-xl md:rounded-2xl border-2 border-gray-700/80 shadow-[0_0_30px_rgba(249,115,22,0.3)] backdrop-blur-sm overflow-hidden flex items-center">

                    <!-- Track Background Gradient -->
                    <div class="absolute inset-0 bg-gradient-to-r from-gray-800/30 via-transparent to-black/60 pointer-events-none z-0"></div>

                    <!-- Liquid Fill (Vivid Orange) -->
                    <div class="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-orange-400 to-orange-500 transition-all duration-1000 ease-in-out z-10" style="width: ${clampedPercent}%;">

                        <!-- Diagonal Wave Tip -->
                        <div class="absolute top-[-50%] bottom-[-50%] -right-8 w-16 bg-orange-500 transform skew-x-[-20deg] overflow-hidden flex items-center justify-center">
                             <!-- Wave Animation (Vertical Ripple on the Edge) -->
                             <div class="absolute inset-0 w-full h-[200%] -top-1/2 animate-wave-vertical opacity-50">
                                <svg viewBox="0 0 150 500" preserveAspectRatio="none" class="w-full h-full fill-orange-300">
                                    <path d="M49.98,0.00 C150.00,149.99 -49.98,349.20 49.98,500.00 L150.00,500.00 L150.00,0.00 Z" />
                                </svg>
                             </div>
                        </div>
                    </div>

                    <!-- Text Content (Overlay) -->
                    <div class="absolute inset-0 flex justify-between items-center px-4 md:px-8 z-30 pointer-events-none">
                        <!-- Left: Info -->
                        <div class="flex flex-col items-start">
                            <span class="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider mb-0.5 md:mb-1">Realizado</span>
                            <span class="text-sm md:text-2xl font-bold text-white drop-shadow-md">${formattedValue}</span>
                        </div>

                        <!-- Center: Percentage -->
                        <div class="flex flex-col items-center">
                             <span class="text-2xl md:text-5xl font-black tracking-tighter text-white drop-shadow-[0_0_10px_rgba(251,146,60,0.8)]">
                                ${displayPercentage}%
                            </span>
                        </div>

                        <!-- Right: Goal -->
                        <div class="flex flex-col items-end">
                            <span class="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider mb-0.5 md:mb-1">Meta</span>
                            <span class="text-xs md:text-xl font-bold text-orange-400 drop-shadow-sm">${formattedGoal}</span>
                        </div>
                    </div>

                    <!-- Glass Shine -->
                    <div class="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/5 to-transparent pointer-events-none z-20"></div>
                </div>
            </div>
        `;

        container.innerHTML = html;
    }

    function renderInnovationsChart(tableData) {
        const am5 = window.am5;
        const am5hierarchy = window.am5hierarchy;
        const am5themes_Animated = window.am5themes_Animated;
        const am5themes_Dark = window.am5themes_Dark;

        // 1. Dispose existing root
        if (innovationsAmChartRoot) {
            innovationsAmChartRoot.dispose();
            innovationsAmChartRoot = null;
        }

        const container = document.getElementById('innovations-month-chartContainer');
        if (!container) return;
        container.innerHTML = '';

        if (!am5 || !am5hierarchy) {
            console.warn("amCharts 5 or Hierarchy plugin not loaded.");
            container.innerHTML = '<div class="flex items-center justify-center h-full text-slate-500">Erro ao carregar gráfico (Bibliotecas ausentes).</div>';
            return;
        }

        if (!am5hierarchy.ForceDirected) {
             console.warn("am5hierarchy.ForceDirected not available.");
             container.innerHTML = '<div class="flex items-center justify-center h-full text-slate-500">Erro: Tipo de gráfico não suportado.</div>';
             return;
        }

        if (!tableData || tableData.length === 0) {
            container.innerHTML = '<div class="flex items-center justify-center h-full text-slate-500">Sem dados para exibir.</div>';
            return;
        }

        // 2. Transform Data for Hierarchy
        // Root -> Category -> Product
        const rootData = {
            name: "Inovações",
            children: []
        };

        const catMap = new Map();

        tableData.forEach(item => {
            if (!item.categoryName) return;

            if (!catMap.has(item.categoryName)) {
                catMap.set(item.categoryName, {
                    name: item.categoryName,
                    children: []
                });
                rootData.children.push(catMap.get(item.categoryName));
            }

            const catNode = catMap.get(item.categoryName);
            const val = item.clientsCurrentCount || 0;

            if (val > 0) {
                catNode.children.push({
                    name: item.productName,
                    value: val,
                    stock: item.stock,
                    code: item.productCode
                });
            }
        });

        // If no data after filtering 0s
        if (rootData.children.every(c => c.children.length === 0)) {
             container.innerHTML = '<div class="flex items-center justify-center h-full text-slate-500">Nenhum produto positivado neste mês.</div>';
             return;
        }

        // 3. Create Chart
        const root = am5.Root.new("innovations-month-chartContainer");
        innovationsAmChartRoot = root;

        if (root._logo) {
            root._logo.dispose();
        }

        const themes = [];
        // OPTIMIZATION: Disable Animated theme to improve FPS on low-end devices
        // if (am5themes_Animated) themes.push(am5themes_Animated.new(root));
        if (am5themes_Dark) themes.push(am5themes_Dark.new(root));

        root.setThemes(themes);

        const series = root.container.children.push(
            am5hierarchy.ForceDirected.new(root, {
                singleBranchOnly: false,
                downDepth: 1,
                topDepth: 1,
                initialDepth: 2,
                valueField: "value",
                categoryField: "name",
                childDataField: "children",
                idField: "name",
                linkWithStrength: 0,
                manyBodyStrength: -20,
                centerStrength: 0.8,
                minRadius: 35,
                maxRadius: am5.percent(14.5),
                velocityDecay: 0.8, // Increased for stability
                initialVelocity: 0.02 // Decreased for stability
            })
        );

        series.get("colors").setAll({
            step: 2
        });

        series.links.template.set("strength", 0.5);

        series.data.setAll([rootData]);

        // Safety: Only set selected item if data items exist
        if (series.dataItems && series.dataItems.length > 0) {
            series.set("selectedDataItem", series.dataItems[0]);
        }

        // Configure Nodes (Circles)
        series.nodes.template.setAll({
            tooltipText: "[bold]{name}[/]\nPositivação: {value} PDVs\nEstoque: {stock}",
            draggable: true
        });

        // Labels
        series.labels.template.setAll({
            fontSize: 10,
            text: "{name}",
            oversizedBehavior: "fit",
            breakWords: true,
            textAlign: "center",
            fill: am5.color(0xffffff)
        });

        // Animate
        series.appear(1000, 100);
    }

    function renderCategoryRadarChart(data) {
        // Dispose existing root if present
        if (window.am5 && window.am5.registry && window.am5.registry.rootElements) {
             for (let i = window.am5.registry.rootElements.length - 1; i >= 0; i--) {
                 const r = window.am5.registry.rootElements[i];
                 if (r.dom && r.dom.id === "faturamentoPorFornecedorChartContainer") {
                     r.dispose();
                 }
             }
        }

        const container = document.getElementById('faturamentoPorFornecedorChartContainer');
        if (!container) return;
        container.innerHTML = '';

        if (!window.am5 || !window.am5radar) {
            console.error("amCharts 5 Radar not loaded");
            return;
        }

        const am5 = window.am5;
        const am5xy = window.am5xy;
        const am5radar = window.am5radar;
        const am5themes_Animated = window.am5themes_Animated;

        const root = am5.Root.new("faturamentoPorFornecedorChartContainer");

        if (root._logo) {
            root._logo.dispose();
        }

        root.setThemes([
            am5themes_Animated.new(root),
            window.am5themes_Dark ? window.am5themes_Dark.new(root) : am5themes_Animated.new(root)
        ]);

        // Create chart
        const chart = root.container.children.push(am5radar.RadarChart.new(root, {
            panX: false,
            panY: false,
            wheelX: "panX",
            wheelY: "zoomX",
            innerRadius: am5.percent(20),
            startAngle: -90,
            endAngle: 180
        }));

        // Cursor
        const cursor = chart.set("cursor", am5radar.RadarCursor.new(root, {
            behavior: "zoomX"
        }));
        cursor.lineY.set("visible", false);

        // Axes
        const xRenderer = am5radar.AxisRendererCircular.new(root, {});
        xRenderer.labels.template.setAll({ radius: 10 });
        xRenderer.grid.template.setAll({ forceHidden: true });

        const xAxis = chart.xAxes.push(am5xy.ValueAxis.new(root, {
            renderer: xRenderer,
            min: 0,
            max: 100,
            strictMinMax: false,
            numberFormat: "#'%'",
            tooltip: am5.Tooltip.new(root, {})
        }));

        const yRenderer = am5radar.AxisRendererRadial.new(root, {
            minGridDistance: 10
        });
        yRenderer.labels.template.setAll({
            centerX: am5.p100,
            fontWeight: "500",
            fontSize: 11,
            templateField: "columnSettings",
            oversizedBehavior: "truncate",
            maxWidth: 140
        });
        yRenderer.grid.template.setAll({ forceHidden: true });

        const yAxis = chart.yAxes.push(am5xy.CategoryAxis.new(root, {
            categoryField: "category",
            renderer: yRenderer
        }));
        yAxis.data.setAll(data);

        // Series 1: Meta (Background / 100%)
        const series1 = chart.series.push(am5radar.RadarColumnSeries.new(root, {
            xAxis: xAxis,
            yAxis: yAxis,
            clustered: false,
            valueXField: "full",
            categoryYField: "category",
            fill: root.interfaceColors.get("alternativeBackground")
        }));
        series1.columns.template.setAll({
            width: am5.p100,
            fillOpacity: 0.08,
            strokeOpacity: 0,
            cornerRadius: 20
        });
        series1.data.setAll(data);

        // Series 2: Realizado
        const series2 = chart.series.push(am5radar.RadarColumnSeries.new(root, {
            xAxis: xAxis,
            yAxis: yAxis,
            clustered: false,
            valueXField: "value",
            categoryYField: "category"
        }));
        series2.columns.template.setAll({
            width: am5.p100,
            strokeOpacity: 0,
            tooltipText: "{category}: {valueX.formatNumber('#.0')}%",
            cornerRadius: 20,
            templateField: "columnSettings"
        });
        series2.data.setAll(data);

        // Animation
        series1.appear(1000);
        series2.appear(1000);
        chart.appear(1000, 100);
    }

    // Auto-init User Menu on load if ready (for Navbar)
    if (document.readyState === "complete" || document.readyState === "interactive") {
        initWalletView();
        initRackMultiSelect();
        initCustomFileInput();
        verificarEstadoVisita();

        // Enforce Menu Permissions
        if (window.userRole !== 'adm') {
            document.querySelectorAll('[data-target="goals"]').forEach(el => el.classList.add('hidden'));
        }
    }

        function renderPositivacaoView() {
            setupHierarchyFilters('positivacao', () => handlePositivacaoFilterChange({ excludeFilter: 'hierarchy' }));

            // Setup other filters listeners
            if (positivacaoComRedeBtn && !positivacaoComRedeBtn._hasListener) {
                positivacaoRedeGroupContainer.addEventListener('click', (e) => {
                    const btn = e.target.closest('button');
                    if (!btn) return;

                    const group = btn.dataset.group;
                    positivacaoRedeGroupFilter = group;

                    positivacaoRedeGroupContainer.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');

                    if (group === 'com_rede') {
                        positivacaoRedeFilterDropdown.classList.remove('hidden');
                    } else {
                        positivacaoRedeFilterDropdown.classList.add('hidden');
                    }
                    handlePositivacaoFilterChange({ excludeFilter: 'rede' });
                });
                positivacaoComRedeBtn._hasListener = true;
            }

            if (positivacaoRedeFilterDropdown && !positivacaoRedeFilterDropdown._hasListener) {
                positivacaoRedeFilterDropdown.addEventListener('change', () => handlePositivacaoFilterChange({ excludeFilter: 'rede' }));
                positivacaoRedeFilterDropdown._hasListener = true;
            }

            // Client Typeahead
            setupClientTypeahead('positivacao-codcli-filter', 'positivacao-codcli-filter-suggestions', (code) => {
                handlePositivacaoFilterChange({ excludeFilter: 'client' });
            });
            // Manual Input listener for clearing
            if (positivacaoCodCliFilter && !positivacaoCodCliFilter._hasListener) {
                positivacaoCodCliFilter.addEventListener('input', (e) => {
                    if (!e.target.value) handlePositivacaoFilterChange({ excludeFilter: 'client' });
                });
                positivacaoCodCliFilter._hasListener = true;
            }

            if (clearPositivacaoFiltersBtn && !clearPositivacaoFiltersBtn._hasListener) {
                clearPositivacaoFiltersBtn.addEventListener('click', resetPositivacaoFilters);
                clearPositivacaoFiltersBtn._hasListener = true;
            }

            const pActivePrev = document.getElementById('positivacao-active-prev-btn');
            if (pActivePrev && !pActivePrev._hasListener) {
                pActivePrev.addEventListener('click', () => {
                    if(positivacaoActiveState.page > 1) {
                        positivacaoActiveState.page--;
                        renderPositivacaoActiveTable();
                    }
                });
                pActivePrev._hasListener = true;

                document.getElementById('positivacao-active-next-btn').addEventListener('click', () => {
                    const max = Math.ceil(positivacaoActiveState.data.length / positivacaoActiveState.limit);
                    if(positivacaoActiveState.page < max) {
                        positivacaoActiveState.page++;
                        renderPositivacaoActiveTable();
                    }
                });

                document.getElementById('positivacao-inactive-prev-btn').addEventListener('click', () => {
                    if(positivacaoInactiveState.page > 1) {
                        positivacaoInactiveState.page--;
                        renderPositivacaoInactiveTable();
                    }
                });

                document.getElementById('positivacao-inactive-next-btn').addEventListener('click', () => {
                    const max = Math.ceil(positivacaoInactiveState.data.length / positivacaoInactiveState.limit);
                    if(positivacaoInactiveState.page < max) {
                        positivacaoInactiveState.page++;
                        renderPositivacaoInactiveTable();
                    }
                });
            }

            // Initial Update
            updateAllPositivacaoFilters();
            updatePositivacaoView();
        }

        function getPositivacaoFilteredData(options = {}) {
            const { excludeFilter = null } = options;

            // 1. Hierarchy Filter (Base)
            let clients = getHierarchyFilteredClients('positivacao', allClientsData);

            // 2. Filter by Rede, Client, etc.
            const isComRede = positivacaoRedeGroupFilter === 'com_rede';
            const isSemRede = positivacaoRedeGroupFilter === 'sem_rede';
            const redeSet = (isComRede && selectedPositivacaoRedes.length > 0) ? new Set(selectedPositivacaoRedes) : null;
            const clientFilter = positivacaoCodCliFilter.value.trim().toLowerCase();

            if (positivacaoRedeGroupFilter || clientFilter) {
                 const temp = [];
                 const len = clients.length;
                 const checkRede = excludeFilter !== 'rede';
                 const checkClient = excludeFilter !== 'client' && !!clientFilter;

                 for(let i=0; i<len; i++) {
                     const c = clients[i];
                     if (checkRede) {
                        if (isComRede) {
                            if (!c.ramo || c.ramo === 'N/A') continue;
                            if (redeSet && !redeSet.has(c.ramo)) continue;
                        } else if (isSemRede) {
                            if (c.ramo && c.ramo !== 'N/A') continue;
                        }
                     }
                     if (checkClient) {
                        const code = String(c['Código'] || c['codigo_cliente']).toLowerCase();
                        const name = (c.nomeCliente || '').toLowerCase();
                        const city = (c.cidade || '').toLowerCase();
                        const bairro = (c.bairro || '').toLowerCase();
                        const cnpj = String(c['CNPJ/CPF'] || c.cnpj_cpf || '').replace(/\D/g, '');

                        if (!code.includes(clientFilter) && !name.includes(clientFilter) && !city.includes(clientFilter) && !bairro.includes(clientFilter) && !cnpj.includes(clientFilter)) continue;
                     }
                     temp.push(c);
                 }
                 clients = temp;
            }

            // Get matching sales
            const clientCodes = new Set();
            for(let i=0; i<clients.length; i++) clientCodes.add(clients[i]['Código']);

            const filters = {
                clientCodes: clientCodes
            };
            const sales = getFilteredDataFromIndices(optimizedData.indices.current, optimizedData.salesById, filters);

            return { clients, sales };
        }

        function updateAllPositivacaoFilters(options = {}) {
            const { skipFilter = null } = options;
            if (skipFilter !== 'rede') {
                 const { clients } = getPositivacaoFilteredData({ excludeFilter: 'rede' });
                 if (positivacaoRedeGroupFilter === 'com_rede') {
                     selectedPositivacaoRedes = updateRedeFilter(positivacaoRedeFilterDropdown, positivacaoComRedeBtnText, selectedPositivacaoRedes, clients);
                 }
            }
        }

        function handlePositivacaoFilterChange(options = {}) {
            if (window.positivacaoUpdateTimeout) clearTimeout(window.positivacaoUpdateTimeout);
            window.positivacaoUpdateTimeout = setTimeout(() => {
                updateAllPositivacaoFilters(options);
                updatePositivacaoView();
            }, 10);
        }

        function resetPositivacaoFilters() {
            selectedPositivacaoCoords = [];
            selectedPositivacaoCoCoords = [];
            selectedPositivacaoPromotors = [];
            selectedPositivacaoRedes = [];
            positivacaoRedeGroupFilter = '';
            positivacaoCodCliFilter.value = '';

            if (positivacaoRedeGroupContainer) {
                positivacaoRedeGroupContainer.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                positivacaoRedeGroupContainer.querySelector('button[data-group=""]').classList.add('active');
            }
            if (positivacaoRedeFilterDropdown) positivacaoRedeFilterDropdown.classList.add('hidden');

            setupHierarchyFilters('positivacao');
            updateAllPositivacaoFilters();
            updatePositivacaoView();
        }

        function updatePositivacaoView() {
            positivacaoRenderId++;
            const currentRenderId = positivacaoRenderId;

            if (positivacaoActiveDetailTableBody) positivacaoActiveDetailTableBody.innerHTML = getSkeletonRows(7, 5);
            if (positivacaoInactiveDetailTableBody) positivacaoInactiveDetailTableBody.innerHTML = getSkeletonRows(6, 5);

            const { clients, sales } = getPositivacaoFilteredData();

            const clientTotals = new Map();
            const clientDetails = new Map();

            sales.forEach(s => {
                const cod = s.CODCLI;
                const val = Number(s.VLVENDA) || 0;
                clientTotals.set(cod, (clientTotals.get(cod) || 0) + val);

                if (!clientDetails.has(cod)) clientDetails.set(cod, { pepsico: 0, multimarcas: 0 });
                const d = clientDetails.get(cod);
                const pasta = s.OBSERVACAOFOR || s.PASTA;
                if (pasta === 'PEPSICO') d.pepsico += val;
                else if (pasta === 'MULTIMARCAS') d.multimarcas += val;
            });

            const activeList = [];
            const inactiveList = [];

            runAsyncChunked(clients, (c) => {
                const cod = String(c['Código'] || c['codigo_cliente']);
                const total = clientTotals.get(cod) || 0;

                const registrationDate = parseDate(c.dataCadastro);
                const now = lastSaleDate;
                const isNew = registrationDate && registrationDate.getUTCMonth() === now.getUTCMonth() && registrationDate.getUTCFullYear() === now.getUTCFullYear();

                if (total >= 1) {
                    const det = clientDetails.get(cod) || { pepsico: 0, multimarcas: 0 };
                    activeList.push({
                        ...c,
                        total,
                        pepsico: det.pepsico,
                        multimarcas: det.multimarcas,
                        outros: total - det.pepsico - det.multimarcas,
                        isNew
                    });
                } else {
                    c.isReturn = (total < 0);
                    c.isNewForInactiveLabel = isNew && !parseDate(c.ultimaCompra);
                    inactiveList.push(c);
                }
            }, () => {
                if (currentRenderId !== positivacaoRenderId) return;

                activeList.sort((a, b) => b.total - a.total);
                inactiveList.sort((a, b) => (parseDate(b.ultimaCompra) || 0) - (parseDate(a.ultimaCompra) || 0));

                positivacaoDataForExport.active = activeList;
                positivacaoDataForExport.inactive = inactiveList;

                positivacaoActiveState.data = activeList;
                positivacaoActiveState.page = 1;

                positivacaoInactiveState.data = inactiveList;
                positivacaoInactiveState.page = 1;

                renderPositivacaoActiveTable();
                renderPositivacaoInactiveTable();
            });
        }

        function renderPositivacaoActiveTable() {
            const tbody = document.getElementById('positivacao-active-detail-table-body');
            if (!tbody) return;

            const { page, limit, data } = positivacaoActiveState;
            const total = data.length;
            const start = (page - 1) * limit;
            const end = start + limit;
            const subset = data.slice(start, end);
            const totalPages = Math.ceil(total / limit) || 1;

            tbody.innerHTML = subset.map(data => {
                const novoLabel = data.isNew ? `<span class="ml-2 text-xs font-semibold text-purple-400 bg-purple-900/50 px-2 py-0.5 rounded-full">NOVO</span>` : '';
                let tooltipParts = [];
                if (data.pepsico > 0) tooltipParts.push(`PEPSICO: ${data.pepsico.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`);
                if (data.multimarcas > 0) tooltipParts.push(`MULTIMARCAS: ${data.multimarcas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`);
                if (data.outros > 0.001) tooltipParts.push(`OUTROS: ${data.outros.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`);
                const tooltipText = tooltipParts.length > 0 ? tooltipParts.join('<br>') : 'Sem detalhamento';

                const rcaVal = (data.rcas && data.rcas.length > 0) ? data.rcas[0] : '-';
                const nome = data.fantasia || data.nomeCliente || 'N/A';
                const cidade = data.cidade || 'N/A';
                const bairro = data.bairro || 'N/A';

                return `<tr class="hover:bg-slate-700">
                            <td class="px-2 py-2 md:px-4 md:py-2 text-[10px] md:text-sm"><a href="#" class="text-teal-400 hover:underline" data-codcli="${window.escapeHtml(data['Código'])}">${window.escapeHtml(data['Código'])}</a></td>
                            <td class="px-2 py-2 md:px-4 md:py-2 flex items-center text-[10px] md:text-sm truncate max-w-[120px] md:max-w-xs">${window.escapeHtml(nome)}${novoLabel}</td>
                            <td class="px-2 py-2 md:px-4 md:py-2 text-right text-[10px] md:text-sm">
                                <div class="tooltip">${data.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    <span class="tooltip-text" style="width: max-content; transform: translateX(-50%); margin-left: 0;">${tooltipText}</span>
                                </div>
                            </td>
                            <td class="px-2 py-2 md:px-4 md:py-2 text-[10px] md:text-sm hidden md:table-cell">${window.escapeHtml(cidade)}</td>
                            <td class="px-2 py-2 md:px-4 md:py-2 text-[10px] md:text-sm hidden md:table-cell">${window.escapeHtml(bairro)}</td>
                            <td class="px-2 py-2 md:px-4 md:py-2 text-center text-[10px] md:text-sm hidden md:table-cell">${formatDate(data.ultimaCompra)}</td>
                            <td class="px-2 py-2 md:px-4 md:py-2 text-[10px] md:text-sm hidden md:table-cell">${window.escapeHtml(rcaVal)}</td>
                        </tr>`;
            }).join('');

            // Update Pagination Controls
            document.getElementById('positivacao-active-prev-btn').disabled = page === 1;
            document.getElementById('positivacao-active-next-btn').disabled = page >= totalPages;
            document.getElementById('positivacao-active-page-info').textContent = `${start + 1}-${Math.min(end, total)} de ${total}`;
        }

        function renderPositivacaoInactiveTable() {
            const tbody = document.getElementById('positivacao-inactive-detail-table-body');
            if (!tbody) return;

            const { page, limit, data } = positivacaoInactiveState;
            const total = data.length;
            const start = (page - 1) * limit;
            const end = start + limit;
            const subset = data.slice(start, end);
            const totalPages = Math.ceil(total / limit) || 1;

            tbody.innerHTML = subset.map(client => {
                const novoLabel = client.isNewForInactiveLabel ? `<span class="ml-2 text-[9px] md:text-xs font-semibold text-purple-400 bg-purple-900/50 px-1 py-0.5 rounded-full">NOVO</span>` : '';
                const rcaVal = (client.rcas && client.rcas.length > 0) ? client.rcas[0] : '-';
                const nome = client.fantasia || client.nomeCliente || 'N/A';
                const cidade = client.cidade || 'N/A';
                const bairro = client.bairro || 'N/A';
                const ultCompra = client.ultimaCompra || client['Data da Última Compra'];

                return `<tr class="hover:bg-slate-700">
                            <td class="px-2 py-2 md:px-4 md:py-2 text-[10px] md:text-sm"><a href="#" class="text-teal-400 hover:underline" data-codcli="${window.escapeHtml(client['Código'])}">${window.escapeHtml(client['Código'])}</a></td>
                            <td class="px-2 py-2 md:px-4 md:py-2 flex items-center text-[10px] md:text-sm truncate max-w-[120px] md:max-w-xs">${window.escapeHtml(nome)}${novoLabel}</td>
                            <td class="px-2 py-2 md:px-4 md:py-2 text-[10px] md:text-sm hidden md:table-cell">${window.escapeHtml(cidade)}</td>
                            <td class="px-2 py-2 md:px-4 md:py-2 text-[10px] md:text-sm hidden md:table-cell">${window.escapeHtml(bairro)}</td>
                            <td class="px-2 py-2 md:px-4 md:py-2 text-center text-[10px] md:text-sm hidden md:table-cell">${formatDate(ultCompra)}</td>
                            <td class="px-2 py-2 md:px-4 md:py-2 text-[10px] md:text-sm hidden md:table-cell">${window.escapeHtml(rcaVal)}</td>
                        </tr>`;
            }).join('');

            // Update Pagination Controls
            document.getElementById('positivacao-inactive-prev-btn').disabled = page === 1;
            document.getElementById('positivacao-inactive-next-btn').disabled = page >= totalPages;
            document.getElementById('positivacao-inactive-page-info').textContent = `${start + 1}-${Math.min(end, total)} de ${total}`;
        }

        // --- TITULOS VIEW LOGIC ---
        let titulosTableState = { page: 1, limit: 50, filteredData: [] };
        let selectedTitulosRedes = [];
        let titulosRedeGroupFilter = '';
        let titulosRenderId = 0;

        function renderTitulosView() {
            setupHierarchyFilters('titulos', () => handleTitulosFilterChange());

            // Rede Filters
            const redeGroupContainer = document.getElementById('titulos-rede-group-container');
            const comRedeBtn = document.getElementById('titulos-com-rede-btn');
            const comRedeBtnText = document.getElementById('titulos-com-rede-btn-text');
            const redeDropdown = document.getElementById('titulos-rede-filter-dropdown');

            if (redeGroupContainer && !redeGroupContainer._hasListener) {
                redeGroupContainer.addEventListener('click', (e) => {
                    const btn = e.target.closest('button');
                    if (!btn) return;
                    const group = btn.dataset.group;
                    titulosRedeGroupFilter = group;
                    redeGroupContainer.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    if (group === 'com_rede') redeDropdown.classList.remove('hidden');
                    else redeDropdown.classList.add('hidden');
                    handleTitulosFilterChange();
                });
                redeGroupContainer._hasListener = true;
            }

            if (redeDropdown && !redeDropdown._hasListener) {
                redeDropdown.addEventListener('change', () => handleTitulosFilterChange());
                redeDropdown._hasListener = true;
            }

            // Client Search
            setupClientTypeahead('titulos-codcli-filter', 'titulos-codcli-filter-suggestions', (code) => {
                handleTitulosFilterChange();
            });
            const clientInput = document.getElementById('titulos-codcli-filter');
            if (clientInput && !clientInput._hasListener) {
                clientInput.addEventListener('input', (e) => {
                     if (!e.target.value) handleTitulosFilterChange();
                });
                clientInput._hasListener = true;
            }

            // Clear Btn
            const clearBtn = document.getElementById('clear-titulos-filters-btn');
            if(clearBtn && !clearBtn._hasListener) {
                clearBtn.addEventListener('click', () => {
                     resetTitulosFilters();
                });
                clearBtn._hasListener = true;
            }

            // Pagination
            const prevBtn = document.getElementById('titulos-prev-page-btn');
            const nextBtn = document.getElementById('titulos-next-page-btn');
            if(prevBtn && !prevBtn._hasListener) {
                prevBtn.addEventListener('click', () => {
                    if(titulosTableState.page > 1) {
                        titulosTableState.page--;
                        renderTitulosTable();
                    }
                });
                prevBtn._hasListener = true;
            }
            if(nextBtn && !nextBtn._hasListener) {
                nextBtn.addEventListener('click', () => {
                    const max = Math.ceil(titulosTableState.filteredData.length / titulosTableState.limit);
                    if(titulosTableState.page < max) {
                        titulosTableState.page++;
                        renderTitulosTable();
                    }
                });
                nextBtn._hasListener = true;
            }

            // Initial Filter Population (Rede)
            updateTitulosRedeFilter();

            // Initial Render
            updateTitulosView();
        }

        function updateTitulosRedeFilter() {
            // Get available networks from clients that have titles? Or all clients?
            // Usually from filtered base.
            // For simplicity, we use the hierarchy filtered clients to populate red dropdown.
            const clients = getHierarchyFilteredClients('titulos', allClientsData);
            const dropdown = document.getElementById('titulos-rede-filter-dropdown');
            const btnText = document.getElementById('titulos-com-rede-btn-text');
            if(dropdown) {
                selectedTitulosRedes = updateRedeFilter(dropdown, btnText, selectedTitulosRedes, clients);
            }
        }

        function handleTitulosFilterChange() {
             if(window.titulosUpdateTimeout) clearTimeout(window.titulosUpdateTimeout);
             window.titulosUpdateTimeout = setTimeout(() => {
                 updateTitulosView();
             }, 10);
        }

        function resetTitulosFilters() {
            selectedTitulosRedes = [];
            titulosRedeGroupFilter = '';
            document.getElementById('titulos-codcli-filter').value = '';

            const groupContainer = document.getElementById('titulos-rede-group-container');
            if(groupContainer) {
                 groupContainer.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                 groupContainer.querySelector('button[data-group=""]').classList.add('active');
            }
            const dd = document.getElementById('titulos-rede-filter-dropdown');
            if(dd) dd.classList.add('hidden');

            setupHierarchyFilters('titulos'); // Reset hierarchy
            updateTitulosRedeFilter();
            updateTitulosView();
        }

        function updateTitulosView() {
            titulosRenderId++;
            const currentId = titulosRenderId;

            // 1. Get Data
            const rawTitulos = embeddedData.titulos; // Columnar
            if (!rawTitulos || !rawTitulos.length) {
                // Empty state
                renderTitulosKPIs(0, 0, 0, 0);
                titulosTableState.filteredData = [];
                renderTitulosTable();
                return;
            }

            // 2. Filter Clients Base (Hierarchy + Rede)
            // Use Hierarchy Filter
            let allowedClients = getHierarchyFilteredClients('titulos', allClientsData);

            // Apply Rede Filter
            const isComRede = titulosRedeGroupFilter === 'com_rede';
            const isSemRede = titulosRedeGroupFilter === 'sem_rede';
            const redeSet = (isComRede && selectedTitulosRedes.length > 0) ? new Set(selectedTitulosRedes) : null;
            const clientSearch = document.getElementById('titulos-codcli-filter').value.toLowerCase().trim();

            const allowedClientCodes = new Set();
            for(let i=0; i<allowedClients.length; i++) {
                const c = allowedClients[i]; // Proxy or Object

                // Rede Check
                if (isComRede) {
                    if (!c.ramo || c.ramo === 'N/A') continue;
                    if (redeSet && !redeSet.has(c.ramo)) continue;
                } else if (isSemRede) {
                    if (c.ramo && c.ramo !== 'N/A') continue;
                }

                // Search Check (Name/Code) - Optimization: Check here to reduce set size
                if (clientSearch) {
                    const code = String(c['Código'] || c['codigo_cliente']).toLowerCase();
                    const name = (c.nomeCliente || '').toLowerCase();
                    if (!code.includes(clientSearch) && !name.includes(clientSearch)) continue;
                }

                allowedClientCodes.add(normalizeKey(c['Código'] || c['codigo_cliente']));
            }

            // 3. Filter Titulos based on Allowed Client Codes
            const filteredTitulos = [];
            const isCol = rawTitulos instanceof ColumnarDataset;
            const len = rawTitulos.length;

            // Indices
            // We assume column names from SQL: cod_cliente, vl_receber, etc.
            // But 'embeddedData.titulos' comes from 'fetchAll' which uses CSV parser.
            // The CSV parser uppercases headers. So: COD_CLIENTE, VL_RECEBER, etc.

            // Let's verify column names dynamically or assume standard
            // Standard from CSV parser: keys are UPPERCASE of DB columns.
            // DB: cod_cliente -> CSV: COD_CLIENTE

            // Optimized read with Dual Case Check (Lowercase and Uppercase)
            const getVal = (i, col) => {
                const val = isCol ? (rawTitulos._data[col] ? rawTitulos._data[col][i] : undefined) : rawTitulos[i][col];
                if (val !== undefined) return val;
                // Try Uppercase
                const colUpper = col.toUpperCase();
                return isCol ? (rawTitulos._data[colUpper] ? rawTitulos._data[colUpper][i] : undefined) : rawTitulos[i][colUpper];
            };

            let totalReceber = 0;

            let countCritical = 0;
            const today = new Date();
            today.setHours(0,0,0,0);

            // Critical Date: 60 days ago
            const criticalDate = new Date();
            criticalDate.setDate(today.getDate() - 60);

            for (let i=0; i<len; i++) {
                const codCli = normalizeKey(getVal(i, 'cod_cliente'));

                if (allowedClientCodes.has(codCli)) {
                    // Match!
                    const valReceber = Number(getVal(i, 'vl_receber')) || 0;
                    const valOriginal = Number(getVal(i, 'vl_titulos')) || 0;
                    const dtVenc = parseDate(getVal(i, 'dt_vencimento'));

                    totalReceber += valReceber;

                    let isCritical = false;
                    let daysOverdue = 0;

                    if (dtVenc && valReceber > 0) {
                        if (dtVenc < criticalDate) {
                            isCritical = true;
                            countCritical++;
                        }
                        // Calculate days overdue if past due
                        if (dtVenc < today) {
                             const diffTime = Math.abs(today - dtVenc);
                             daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        }
                    }

                    // Enrich Data for Table
                    // Resolve Client Name and RCA
                    const clientObj = clientMapForKPIs.get(codCli);
                    let clientName = 'Desconhecido';
                    let rcaName = 'N/A';
                    let city = 'N/A';

                    if (clientObj) {
                         let c = clientObj;
                         if (typeof clientObj === 'number') {
                             c = allClientsData.get(clientObj);
                         }

                         clientName = c.nomeCliente || c.fantasia || 'N/A';
                         city = c.cidade || 'N/A';
                         const rcaCode = String(c.rca1 || '').trim();
                         // Resolve RCA Name
                         if (optimizedData.rcaNameByCode && optimizedData.rcaNameByCode.has(rcaCode)) {
                             rcaName = optimizedData.rcaNameByCode.get(rcaCode) || rcaCode;
                         } else {
                             rcaName = rcaCode;
                         }
                    }

                    filteredTitulos.push({
                        codCli,
                        clientName,
                        rcaName,
                        city,
                        dtVenc,
                        valReceber,
                        valOriginal,
                        isCritical,
                        daysOverdue
                    });
                }
            }

            // Update State
            titulosTableState.filteredData = filteredTitulos;
            titulosTableState.page = 1;

            // Sort by Date Ascending (Oldest first usually for debt)
            titulosTableState.filteredData.sort((a,b) => (a.dtVenc || 0) - (b.dtVenc || 0));

            // KPIs
            const totalCount = filteredTitulos.length;
            const uniqueClientsCritical = new Set(filteredTitulos.filter(t => t.isCritical).map(t => t.codCli)).size;

            // Calculate Total Critical Debt
            const criticalDebt = filteredTitulos.reduce((acc, t) => t.isCritical ? acc + t.valReceber : acc, 0);

            renderTitulosKPIs(totalReceber, criticalDebt, uniqueClientsCritical, totalCount);
            renderTitulosTable();
        }

        function renderTitulosKPIs(total, critical, criticalCount, count) {
            document.getElementById('titulos-kpi-total-debt').textContent = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            document.getElementById('titulos-kpi-critical-debt').textContent = critical.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            document.getElementById('titulos-kpi-critical-count').textContent = `${criticalCount} Clientes Críticos`;
            document.getElementById('titulos-kpi-count').textContent = count;
        }

        function renderTitulosTable() {
            const tbody = document.getElementById('titulos-table-body');
            if(!tbody) return;

            const { page, limit, filteredData } = titulosTableState;
            const total = filteredData.length;
            const start = (page - 1) * limit;
            const end = start + limit;
            const subset = filteredData.slice(start, end);
            const totalPages = Math.ceil(total / limit) || 1;

            if (total === 0) {
                tbody.innerHTML = '<tr><td colspan="8" class="text-center py-8 text-slate-500">Nenhum título encontrado.</td></tr>';
                document.getElementById('titulos-page-info-text').textContent = '0 de 0';
                return;
            }

            tbody.innerHTML = subset.map(t => {
                const dateStr = t.dtVenc ? t.dtVenc.toLocaleDateString('pt-BR') : '-';
                const valOrig = t.valOriginal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                const valOpen = t.valReceber.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

                let status;
                if (t.isCritical) {
                     status = `<span class="px-2 py-1 bg-red-900/50 text-red-300 text-[10px] font-bold rounded-full border border-red-800">${t.daysOverdue} Dias</span>`;
                } else {
                     status = `<span class="px-2 py-1 bg-green-900/50 text-green-300 text-[10px] font-bold rounded-full border border-green-800">Em Aberto</span>`;
                }

                return `
                    <tr class="hover:bg-slate-700/50 border-b border-white/5 transition-colors">
                        <td class="px-4 py-3 font-mono text-xs text-slate-400">${t.codCli}</td>
                        <td class="px-4 py-3 text-sm text-white font-medium truncate max-w-[200px]" title="${t.clientName}">${t.clientName}</td>
                        <td class="px-4 py-3 text-xs text-slate-300 hidden md:table-cell">${t.rcaName}</td>
                        <td class="px-4 py-3 text-xs text-slate-400 hidden md:table-cell">${t.city}</td>
                        <td class="px-4 py-3 text-xs text-white text-center font-mono">${dateStr}</td>
                        <td class="px-4 py-3 text-xs text-slate-500 text-right hidden md:table-cell">${valOrig}</td>
                        <td class="px-4 py-3 text-sm text-white font-bold text-right">${valOpen}</td>
                        <td class="px-4 py-3 text-center">${status}</td>
                    </tr>
                `;
            }).join('');

            // Pagination UI
            document.getElementById('titulos-prev-page-btn').disabled = page === 1;
            document.getElementById('titulos-next-page-btn').disabled = page >= totalPages;
            document.getElementById('titulos-page-info-text').textContent = `${start + 1}-${Math.min(end, total)} de ${total}`;
        }
    let lpState = { page: 1, limit: 50, filteredData: [] };
    let selectedLpRedes = [];
    let lpRedeGroupFilter = '';
    let lpRenderId = 0;

    function renderLojaPerfeitaView() {
        setupHierarchyFilters('lp', () => handleLpFilterChange());

        // Rede Filters
        const redeGroupContainer = document.getElementById('lp-rede-group-container');
        const comRedeBtn = document.getElementById('lp-com-rede-btn');
        const comRedeBtnText = document.getElementById('lp-com-rede-btn-text');
        const redeDropdown = document.getElementById('lp-rede-filter-dropdown');

        if (redeGroupContainer && !redeGroupContainer._hasListener) {
            redeGroupContainer.addEventListener('click', (e) => {
                const btn = e.target.closest('button');
                if (!btn) return;
                const group = btn.dataset.group;
                lpRedeGroupFilter = group;
                redeGroupContainer.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (group === 'com_rede') redeDropdown.classList.remove('hidden');
                else redeDropdown.classList.add('hidden');
                handleLpFilterChange();
            });
            redeGroupContainer._hasListener = true;
        }

        if (redeDropdown && !redeDropdown._hasListener) {
            redeDropdown.addEventListener('change', () => handleLpFilterChange());
            redeDropdown._hasListener = true;
        }

        // Client Search
        setupClientTypeahead('lp-codcli-filter', 'lp-codcli-filter-suggestions', (code) => {
            handleLpFilterChange();
        });
        const clientInput = document.getElementById('lp-codcli-filter');
        if (clientInput && !clientInput._hasListener) {
            clientInput.addEventListener('input', (e) => {
                 if (!e.target.value) handleLpFilterChange();
            });
            clientInput._hasListener = true;
        }

        // Clear Btn
        const clearBtn = document.getElementById('clear-lp-filters-btn');
        if(clearBtn && !clearBtn._hasListener) {
            clearBtn.addEventListener('click', () => {
                 resetLpFilters();
            });
            clearBtn._hasListener = true;
        }

        // Pagination
        const prevBtn = document.getElementById('lp-prev-page-btn');
        const nextBtn = document.getElementById('lp-next-page-btn');
        if(prevBtn && !prevBtn._hasListener) {
            prevBtn.addEventListener('click', () => {
                if(lpState.page > 1) {
                    lpState.page--;
                    renderLpTable();
                }
            });
            prevBtn._hasListener = true;
        }
        if(nextBtn && !nextBtn._hasListener) {
            nextBtn.addEventListener('click', () => {
                const max = Math.ceil(lpState.filteredData.length / lpState.limit);
                if(lpState.page < max) {
                    lpState.page++;
                    renderLpTable();
                }
            });
            nextBtn._hasListener = true;
        }

        // Initial Filter Population (Rede)
        updateLpRedeFilter();

        // Initial Render
        updateLpView();
    }

    function updateLpRedeFilter() {
        const clients = getHierarchyFilteredClients('lp', allClientsData);
        const dropdown = document.getElementById('lp-rede-filter-dropdown');
        const btnText = document.getElementById('lp-com-rede-btn-text');
        if(dropdown) {
            selectedLpRedes = updateRedeFilter(dropdown, btnText, selectedLpRedes, clients);
        }
    }

    function handleLpFilterChange() {
         if(window.lpUpdateTimeout) clearTimeout(window.lpUpdateTimeout);
         window.lpUpdateTimeout = setTimeout(() => {
             updateLpView();
         }, 10);
    }

    function resetLpFilters() {
        selectedLpRedes = [];
        lpRedeGroupFilter = '';
        document.getElementById('lp-codcli-filter').value = '';

        const groupContainer = document.getElementById('lp-rede-group-container');
        if(groupContainer) {
             groupContainer.querySelectorAll('button').forEach(b => b.classList.remove('active'));
             groupContainer.querySelector('button[data-group=""]').classList.add('active');
        }
        const dd = document.getElementById('lp-rede-filter-dropdown');
        if(dd) dd.classList.add('hidden');

        setupHierarchyFilters('lp'); // Reset hierarchy
        updateLpRedeFilter();
        updateLpView();
    }

    function updateLpView() {
        lpRenderId++;
        const currentId = lpRenderId;

        // 1. Get Data
        const rawData = embeddedData.nota_perfeita;
        if (!rawData || !rawData.length) {
            // Empty state
            renderLpKPIs(0, 0, 0, 0);
            lpState.filteredData = [];
            renderLpTable();
            return;
        }

        // 2. Filter Clients Base (Hierarchy + Rede)
        let allowedClients = getHierarchyFilteredClients('lp', allClientsData);

        // Apply Rede Filter
        const isComRede = lpRedeGroupFilter === 'com_rede';
        const isSemRede = lpRedeGroupFilter === 'sem_rede';
        const redeSet = (isComRede && selectedLpRedes.length > 0) ? new Set(selectedLpRedes) : null;
        const clientSearch = document.getElementById('lp-codcli-filter').value.toLowerCase().trim();

        const allowedClientCodes = new Set();
        const clientMap = new Map(); // Store metadata for table enrichment

        for(let i=0; i<allowedClients.length; i++) {
            const c = allowedClients[i];

            // Rede Check
            if (isComRede) {
                if (!c.ramo || c.ramo === 'N/A') continue;
                if (redeSet && !redeSet.has(c.ramo)) continue;
            } else if (isSemRede) {
                if (c.ramo && c.ramo !== 'N/A') continue;
            }

            // Search Check
            if (clientSearch) {
                const code = String(c['Código'] || c['codigo_cliente']).toLowerCase();
                const name = (c.nomeCliente || '').toLowerCase();
                if (!code.includes(clientSearch) && !name.includes(clientSearch)) continue;
            }

            const code = normalizeKey(c['Código'] || c['codigo_cliente']);
            allowedClientCodes.add(code);
            clientMap.set(code, c);
        }

        // 3. Filter Data
        const filtered = rawData.filter(row => allowedClientCodes.has(normalizeKey(row.codigo_cliente))).map(row => {
             const c = clientMap.get(normalizeKey(row.codigo_cliente));
             return {
                 ...row,
                 clientName: c ? (c.nomeCliente || c.fantasia) : 'Desconhecido',
                 city: c ? (c.cidade || 'N/A') : 'N/A'
             };
        });

        // 4. Update KPIs
        let totalScore = 0;
        let totalAudits = 0;
        let totalPerfectAudits = 0;
        let perfectStoresCount = 0;

        filtered.forEach(item => {
            totalScore += item.nota_media;
            totalAudits += item.auditorias;
            totalPerfectAudits += item.auditorias_perfeitas;
            if (item.nota_media >= 80) perfectStoresCount++;
        });

        const avgScore = filtered.length > 0 ? (totalScore / filtered.length) : 0;
        // Perfect Store %: (Perfect Audits / Total Audits) * 100
        const perfectPct = totalAudits > 0 ? (totalPerfectAudits / totalAudits) * 100 : 0;

        renderLpKPIs(avgScore, totalAudits, perfectPct, totalPerfectAudits);

        // 5. Update Table
        // Sort by Score Descending
        filtered.sort((a,b) => b.nota_media - a.nota_media);

        lpState.filteredData = filtered;
        lpState.page = 1;
        renderLpTable();
    }

    function renderLpKPIs(avg, audits, perfectPct, perfectCount) {
        document.getElementById('lp-kpi-avg-score').textContent = avg.toFixed(1);
        document.getElementById('lp-kpi-total-audits').textContent = audits;
        document.getElementById('lp-kpi-perfect-stores').textContent = perfectPct.toFixed(1) + '%';
        document.getElementById('lp-kpi-perfect-count').textContent = `${perfectCount} Auditorias`;
    }

    function renderLpTable() {
        const tbody = document.getElementById('lp-table-body');
        if(!tbody) return;

        const { page, limit, filteredData } = lpState;
        const total = filteredData.length;
        const start = (page - 1) * limit;
        const end = start + limit;
        const subset = filteredData.slice(start, end);
        const totalPages = Math.ceil(total / limit) || 1;

        if (total === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-slate-500">Nenhum dado encontrado.</td></tr>';
            document.getElementById('lp-page-info-text').textContent = '0 de 0';
            return;
        }

        tbody.innerHTML = subset.map(t => {
            let colorStyle;
            // Use inline styles to guarantee visibility (Red-500, Yellow-500, Green-500)
            // Added !important to override global table styles on mobile
            if (t.nota_media < 50) colorStyle = 'color: #ef4444 !important;';
            else if (t.nota_media < 80) colorStyle = 'color: #eab308 !important;';
            else colorStyle = 'color: #22c55e !important;';

            return `
                <tr class="hover:bg-slate-700/50 border-b border-white/5 transition-colors flex md:table-row justify-between items-center">
                    <td class="px-4 py-3 font-mono text-xs text-slate-400 hidden md:table-cell">${t.codigo_cliente}</td>
                    <td class="px-4 py-3 text-sm text-white font-medium truncate max-w-[200px] border-none" title="${t.clientName}">${t.clientName}</td>
                    <td class="px-4 py-3 text-xs text-slate-300 hidden md:table-cell">${t.pesquisador}</td>
                    <td class="px-4 py-3 text-xs text-slate-400 hidden md:table-cell">${t.city}</td>
                    <td class="px-4 py-3 text-center font-bold border-none" style="${colorStyle}">${t.nota_media.toFixed(1)}</td>
                </tr>
            `;
        }).join('');

        // Pagination UI
        document.getElementById('lp-prev-page-btn').disabled = page === 1;
        document.getElementById('lp-next-page-btn').disabled = page >= totalPages;
        document.getElementById('lp-page-info-text').textContent = `${start + 1}-${Math.min(end, total)} de ${total}`;
    }
})();

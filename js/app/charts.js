window.App = window.App || {};
window.App.Charts = {
    renderLiquidGauge: function(containerId, value, goal, label) {
        const container = document.getElementById(containerId);
        if (!container) return;

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
                <div class="relative w-full h-16 md:h-24 bg-gray-900/80 rounded-xl md:rounded-2xl border-2 border-gray-700/80 shadow-[0_0_30px_rgba(249,115,22,0.3)] backdrop-blur-sm overflow-hidden flex items-center">
                    <div class="absolute inset-0 bg-gradient-to-r from-gray-800/30 via-transparent to-black/60 pointer-events-none z-0"></div>
                    <div class="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-orange-400 to-orange-500 transition-all duration-1000 ease-in-out z-10" style="width: ${clampedPercent}%;">
                        <div class="absolute top-[-50%] bottom-[-50%] -right-8 w-16 bg-orange-500 transform skew-x-[-20deg] overflow-hidden flex items-center justify-center">
                             <div class="absolute inset-0 w-full h-[200%] -top-1/2 animate-wave-vertical opacity-50">
                                <svg viewBox="0 0 150 500" preserveAspectRatio="none" class="w-full h-full fill-orange-300">
                                    <path d="M49.98,0.00 C150.00,149.99 -49.98,349.20 49.98,500.00 L150.00,500.00 L150.00,0.00 Z" />
                                </svg>
                             </div>
                        </div>
                    </div>
                    <div class="absolute inset-0 flex justify-between items-center px-4 md:px-8 z-30 pointer-events-none">
                        <div class="flex flex-col items-start">
                            <span class="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider mb-0.5 md:mb-1">Realizado</span>
                            <span class="text-sm md:text-2xl font-bold text-white drop-shadow-md">${formattedValue}</span>
                        </div>
                        <div class="flex flex-col items-center">
                             <span class="text-2xl md:text-5xl font-black tracking-tighter text-white drop-shadow-[0_0_10px_rgba(251,146,60,0.8)]">
                                ${displayPercentage}%
                            </span>
                        </div>
                        <div class="flex flex-col items-end">
                            <span class="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider mb-0.5 md:mb-1">Meta</span>
                            <span class="text-xs md:text-xl font-bold text-orange-400 drop-shadow-sm">${formattedGoal}</span>
                        </div>
                    </div>
                    <div class="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/5 to-transparent pointer-events-none z-20"></div>
                </div>
            </div>
        `;

        container.innerHTML = html;
    },

    renderWeeklyComparisonAmChart: function(weekLabels, currentData, historyData, isTendency) {
        if (!window.am5) return;
        const rootId = "weeklyComparisonChartContainer";

        // Cleanup
        if (window.AppState.amChartRoots.weekly) {
            window.AppState.amChartRoots.weekly.dispose();
        }

        const container = document.getElementById(rootId);
        if (!container) return;
        container.innerHTML = '';

        const root = am5.Root.new(rootId);
        window.AppState.amChartRoots.weekly = root;

        if (root._logo) root._logo.dispose();

        root.setThemes([am5themes_Animated.new(root), am5themes_Dark.new(root)]);

        const chart = root.container.children.push(
            am5xy.XYChart.new(root, {
                panX: true, panY: false, wheelX: "panX", wheelY: "zoomX", layout: root.verticalLayout
            })
        );

        const data = weekLabels.map((label, i) => ({
            category: label,
            current: currentData[i] || 0,
            history: historyData[i] || 0
        }));

        const xAxis = chart.xAxes.push(
            am5xy.CategoryAxis.new(root, {
                categoryField: "category",
                renderer: am5xy.AxisRendererX.new(root, { minGridDistance: 30, minorGridEnabled: true }),
                tooltip: am5.Tooltip.new(root, {})
            })
        );
        xAxis.get("renderer").grid.template.set("forceHidden", true);
        xAxis.data.setAll(data);

        const yAxis = chart.yAxes.push(
            am5xy.ValueAxis.new(root, {
                renderer: am5xy.AxisRendererY.new(root, {})
            })
        );
        yAxis.get("renderer").grid.template.set("forceHidden", true);

        const series1 = chart.series.push(
            am5xy.ColumnSeries.new(root, {
                name: isTendency ? "Tendência Semanal" : "Mês Atual",
                xAxis: xAxis, yAxis: yAxis, valueYField: "current", categoryXField: "category",
                fill: am5.color(0x3f51b5),
                tooltip: am5.Tooltip.new(root, { pointerOrientation: "horizontal", labelText: "{name}: [bold]{valueY}[/]" })
            })
        );
        series1.columns.template.setAll({ cornerRadiusTL: 5, cornerRadiusTR: 5, fillOpacity: 0.8, strokeWidth: 0 });
        series1.data.setAll(data);

        const series2 = chart.series.push(
            am5xy.LineSeries.new(root, {
                name: "Média Trimestre",
                xAxis: xAxis, yAxis: yAxis, valueYField: "history", categoryXField: "category",
                stroke: am5.color(0x00e5ff),
                tooltip: am5.Tooltip.new(root, { pointerOrientation: "horizontal", labelText: "{name}: [bold]{valueY}[/]" })
            })
        );
        series2.strokes.template.setAll({ strokeWidth: 3 });
        series2.bullets.push(() => am5.Bullet.new(root, { sprite: am5.Circle.new(root, { radius: 5, fill: series2.get("stroke") }) }));
        series2.data.setAll(data);

        chart.set("cursor", am5xy.XYCursor.new(root, { behavior: "zoomX" })).lineY.set("visible", false);
        chart.children.push(am5.Legend.new(root, { centerX: am5.p50, x: am5.p50 })).data.setAll(chart.series.values);

        series1.appear(1000, 100);
        series2.appear(1000, 100);
        chart.appear(1000, 100);
    },

    renderMonthlyComparisonAmChart: function(labels, dataValues, labelName, colorHex) {
        if (!window.am5) return;
        const rootId = "monthlyComparisonChartContainer";

        if (window.AppState.amChartRoots.monthly) {
            window.AppState.amChartRoots.monthly.dispose();
        }

        const container = document.getElementById(rootId);
        if (!container) return;
        container.innerHTML = '';

        const root = am5.Root.new(rootId);
        window.AppState.amChartRoots.monthly = root;
        if (root._logo) root._logo.dispose();

        root.setThemes([am5themes_Animated.new(root), am5themes_Dark.new(root)]);

        const chart = root.container.children.push(
            am5xy.XYChart.new(root, { panX: true, panY: false, wheelX: "panX", wheelY: "zoomX", layout: root.verticalLayout })
        );

        const data = labels.map((l, i) => ({ category: l, value: dataValues[i] || 0 }));

        const xAxis = chart.xAxes.push(am5xy.CategoryAxis.new(root, {
            categoryField: "category",
            renderer: am5xy.AxisRendererX.new(root, { minGridDistance: 30 }),
            tooltip: am5.Tooltip.new(root, {})
        }));
        xAxis.get("renderer").grid.template.set("forceHidden", true);
        xAxis.data.setAll(data);

        const yAxis = chart.yAxes.push(am5xy.ValueAxis.new(root, { renderer: am5xy.AxisRendererY.new(root, {}) }));
        yAxis.get("renderer").grid.template.set("forceHidden", true);

        const series = chart.series.push(am5xy.ColumnSeries.new(root, {
            name: labelName, xAxis: xAxis, yAxis: yAxis, valueYField: "value", categoryXField: "category",
            fill: am5.color(colorHex),
            tooltip: am5.Tooltip.new(root, { labelText: "{categoryX}: [bold]{valueY}[/]" })
        }));
        series.columns.template.setAll({ cornerRadiusTL: 5, cornerRadiusTR: 5, fillOpacity: 0.8, strokeWidth: 0 });
        series.data.setAll(data);

        chart.set("cursor", am5xy.XYCursor.new(root, { behavior: "zoomX" })).lineY.set("visible", false);
        series.appear(1000, 100);
        chart.appear(1000, 100);
    },

    renderInnovationsChart: function(tableData) {
        if (!window.am5 || !window.am5hierarchy) return;
        const rootId = "innovations-month-chartContainer";

        if (window.AppState.amChartRoots.innovations) {
            window.AppState.amChartRoots.innovations.dispose();
        }

        const container = document.getElementById(rootId);
        if (!container) return;
        container.innerHTML = '';

        if (!tableData || tableData.length === 0) {
            container.innerHTML = '<div class="flex items-center justify-center h-full text-slate-500">Sem dados para exibir.</div>';
            return;
        }

        const rootData = { name: "Inovações", children: [] };
        const catMap = new Map();

        tableData.forEach(item => {
            if (!item.categoryName) return;
            if (!catMap.has(item.categoryName)) {
                catMap.set(item.categoryName, { name: item.categoryName, children: [] });
                rootData.children.push(catMap.get(item.categoryName));
            }
            const val = item.clientsCurrentCount || 0;
            if (val > 0) {
                catMap.get(item.categoryName).children.push({
                    name: item.productName, value: val, stock: item.stock, code: item.productCode
                });
            }
        });

        if (rootData.children.every(c => c.children.length === 0)) {
             container.innerHTML = '<div class="flex items-center justify-center h-full text-slate-500">Nenhum produto positivado neste mês.</div>';
             return;
        }

        const root = am5.Root.new(rootId);
        window.AppState.amChartRoots.innovations = root;
        if (root._logo) root._logo.dispose();

        root.setThemes([am5themes_Dark.new(root)]);

        const series = root.container.children.push(
            am5hierarchy.ForceDirected.new(root, {
                singleBranchOnly: false, downDepth: 1, topDepth: 1, initialDepth: 2,
                valueField: "value", categoryField: "name", childDataField: "children", idField: "name",
                minRadius: 35, maxRadius: am5.percent(18), velocityDecay: 0.6, initialVelocity: 0.05
            })
        );

        series.get("colors").setAll({ step: 2 });
        series.links.template.set("strength", 0.5);
        series.data.setAll([rootData]);

        if (series.dataItems && series.dataItems.length > 0) series.set("selectedDataItem", series.dataItems[0]);

        series.nodes.template.setAll({ tooltipText: "[bold]{name}[/]\nPositivação: {value} PDVs\nEstoque: {stock}", draggable: true });
        series.labels.template.setAll({ fontSize: 10, text: "{name}", oversizedBehavior: "fit", breakWords: true, textAlign: "center", fill: am5.color(0xffffff) });
        series.appear(1000, 100);
    },

    renderCategoryRadarChart: function(data) {
        if (!window.am5 || !window.am5radar) return;
        const rootId = "faturamentoPorFornecedorChartContainer";

        if (window.AppState.amChartRoots.categoryRadar) {
            window.AppState.amChartRoots.categoryRadar.dispose();
        }

        const container = document.getElementById(rootId);
        if (!container) return;
        container.innerHTML = '';

        const root = am5.Root.new(rootId);
        window.AppState.amChartRoots.categoryRadar = root;
        if (root._logo) root._logo.dispose();

        root.setThemes([am5themes_Animated.new(root), am5themes_Dark.new(root)]);

        const chart = root.container.children.push(am5radar.RadarChart.new(root, {
            panX: false, panY: false, wheelX: "panX", wheelY: "zoomX", innerRadius: am5.percent(20), startAngle: -90, endAngle: 180
        }));

        chart.set("cursor", am5radar.RadarCursor.new(root, { behavior: "zoomX" })).lineY.set("visible", false);

        const xRenderer = am5radar.AxisRendererCircular.new(root, {});
        xRenderer.labels.template.setAll({ radius: 10 });
        xRenderer.grid.template.setAll({ forceHidden: true });

        const xAxis = chart.xAxes.push(am5xy.ValueAxis.new(root, {
            renderer: xRenderer, min: 0, max: 100, strictMinMax: false, numberFormat: "#'%'", tooltip: am5.Tooltip.new(root, {})
        }));

        const yRenderer = am5radar.AxisRendererRadial.new(root, { minGridDistance: 10 });
        yRenderer.labels.template.setAll({ centerX: am5.p100, fontWeight: "500", fontSize: 11, templateField: "columnSettings", oversizedBehavior: "truncate", maxWidth: 140 });
        yRenderer.grid.template.setAll({ forceHidden: true });

        const yAxis = chart.yAxes.push(am5xy.CategoryAxis.new(root, { categoryField: "category", renderer: yRenderer }));
        yAxis.data.setAll(data);

        const series1 = chart.series.push(am5radar.RadarColumnSeries.new(root, {
            xAxis: xAxis, yAxis: yAxis, clustered: false, valueXField: "full", categoryYField: "category", fill: root.interfaceColors.get("alternativeBackground")
        }));
        series1.columns.template.setAll({ width: am5.p100, fillOpacity: 0.08, strokeOpacity: 0, cornerRadius: 20 });
        series1.data.setAll(data);

        const series2 = chart.series.push(am5radar.RadarColumnSeries.new(root, {
            xAxis: xAxis, yAxis: yAxis, clustered: false, valueXField: "value", categoryYField: "category"
        }));
        series2.columns.template.setAll({ width: am5.p100, strokeOpacity: 0, tooltipText: "{category}: {valueX.formatNumber('#.0')}%", cornerRadius: 20, templateField: "columnSettings" });
        series2.data.setAll(data);

        series1.appear(1000);
        series2.appear(1000);
        chart.appear(1000, 100);
    }
};

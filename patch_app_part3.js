const fs = require('fs');
let code = fs.readFileSync('/app/js/app/app_part3.js', 'utf8');

const insertionPoint = `    function renderCategoryRadarChart(data) {`;

const newFunction = `    function renderMetasRadarChart(data) {
        // Dispose existing root if present
        if (window.am5 && window.am5.registry && window.am5.registry.rootElements) {
             for (let i = window.am5.registry.rootElements.length - 1; i >= 0; i--) {
                 const r = window.am5.registry.rootElements[i];
                 if (r.dom && r.dom.id === "metasChartContainer") {
                     r.dispose();
                 }
             }
        }

        const container = document.getElementById('metasChartContainer');
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

        const root = am5.Root.new("metasChartContainer");

        if (root._logo) {
            root._logo.dispose();
        }

        root.setThemes([
            am5themes_Animated.new(root),
            window.am5themes_Dark ? window.am5themes_Dark.new(root) : am5themes_Animated.new(root)
        ]);

        const chart = root.container.children.push(am5radar.RadarChart.new(root, {
            panX: false,
            panY: false,
            wheelX: "none",
            wheelY: "none",
            innerRadius: am5.percent(30),
            radius: am5.percent(85)
        }));

        const xRenderer = am5radar.AxisRendererCircular.new(root, {
            strokeOpacity: 0.1,
            minGridDistance: 30
        });

        xRenderer.labels.template.setAll({
            textType: "radial",
            radius: 10,
            paddingTop: 0,
            paddingBottom: 0,
            centerY: am5.p50,
            fontSize: 12,
            fill: am5.color(0x94a3b8)
        });

        xRenderer.grid.template.setAll({
            forceHidden: true
        });

        const xAxis = chart.xAxes.push(am5xy.ValueAxis.new(root, {
            renderer: xRenderer,
            min: 0,
            max: 100,
            strictMinMax: true,
            numberFormat: "#'%'",
            tooltip: am5.Tooltip.new(root, {})
        }));

        const yRenderer = am5radar.AxisRendererRadial.new(root, {
            minGridDistance: 20
        });

        yRenderer.labels.template.setAll({
            centerX: am5.p100,
            fontWeight: "500",
            fontSize: 12,
            fill: am5.color(0xf8fafc)
        });

        yRenderer.grid.template.setAll({
            forceHidden: true
        });

        const yAxis = chart.yAxes.push(am5xy.CategoryAxis.new(root, {
            categoryField: "category",
            renderer: yRenderer
        }));

        yAxis.data.setAll(data);

        // Series 1: Background (Full 100%)
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
            fillOpacity: 0.1,
            strokeOpacity: 0,
            cornerRadius: 20
        });
        series1.data.setAll(data);

        // Series 2: Actual Value
        const series2 = chart.series.push(am5radar.RadarColumnSeries.new(root, {
            xAxis: xAxis,
            yAxis: yAxis,
            clustered: false,
            valueXField: "value",
            categoryYField: "category",
            tooltipText: "{category}\\nAtingimento: {valueX.formatNumber('#.#')}%",
            templateField: "columnSettings"
        }));

        series2.columns.template.setAll({
            width: am5.p100,
            strokeOpacity: 0,
            cornerRadius: 20
        });

        series2.data.setAll(data);

        series1.appear(1000);
        series2.appear(1000);
        chart.appear(1000, 100);
    }

    function renderCategoryRadarChart(data) {`;

if (code.includes('function renderCategoryRadarChart(data) {') && !code.includes('function renderMetasRadarChart(data) {')) {
    code = code.replace(insertionPoint, newFunction);
    fs.writeFileSync('/app/js/app/app_part3.js', code, 'utf8');
    console.log("renderMetasRadarChart function added to app_part3.js.");
} else {
    console.log("Already added or insertion point not found in app_part3.js.");
}

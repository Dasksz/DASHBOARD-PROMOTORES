window.App = window.App || {};
window.App.Dashboard = {
    init: function() {
        window.App.Filters.setupHierarchyFilters('main', () => this.render());
        window.App.Filters.setupGenericFilters('main', {
            'tipo-venda': 'tipo-venda-filter-btn',
            'supplier': 'fornecedor-filter-btn'
        });
    },

    render: function() {
        this.calculateKPIs();
        // Render Charts
        const data = window.AppState.allSalesData; // Need filtered data?
        // Actually App.js usually handles filtering before calling render.
        // But here we might just render based on current filter state.

        // Render Liquid Gauge
        // window.App.Charts.renderLiquidGauge(...);
    },

    calculateTotalSales: function(data) {
        if (!data) return 0;
        const isColumnar = data instanceof window.Utils.ColumnarDataset;
        let total = 0;
        // Optimization: Use reduce
        if (isColumnar) {
            const vals = data._data['VLVENDA']; // Raw access
            if(vals) {
                for(let i=0; i<data.length; i++) total += (Number(vals[i])||0);
            }
        } else {
            for(let i=0; i<data.length; i++) total += (Number(data[i].VLVENDA)||0);
        }
        return total;
    },

    calculateKPIs: function() {
        // Logic to update #total-vendas, #total-peso, etc.
        // ...
        const totalSales = this.calculateTotalSales(window.AppState.allSalesData); // Should use filtered data from AppState
        const el = document.getElementById('total-vendas');
        if(el) el.textContent = totalSales.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
    },

    renderTopProductsVariationTable: function() {
        // Logic ...
    }
};

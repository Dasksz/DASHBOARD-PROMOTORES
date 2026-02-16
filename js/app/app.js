window.App = window.App || {};

window.App.init = function() {
    console.log("App Initializing...");
    
    // Initialize Global State
    this.calculateGlobalState();

    // Initialize Sub-modules
    if (window.App.Wallet) window.App.Wallet.init();
    if (window.App.Visitas) window.App.Visitas.init();
    if (window.App.Goals) window.App.Goals.init();
    if (window.App.Dashboard) window.App.Dashboard.init();
    if (window.App.City) window.App.City.init();
    if (window.App.Comparison) window.App.Comparison.init();
    if (window.App.Coverage) window.App.Coverage.init();
    if (window.App.Mix) window.App.Mix.init();
    if (window.App.Innovations) window.App.Innovations.init();
    if (window.App.History) window.App.History.init();
    // Map is initialized lazily when shown to avoid IndexSizeError

    // Bind Navigation
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const target = e.target.getAttribute('data-target');
            if (target) window.App.renderView(target);
        });
    });

    // Initial View
    window.App.renderView('dashboard');
};

window.App.calculateGlobalState = function() {
    let lastDate = null;
    const history = window.AppState.allHistoryData;
    const sales = window.AppState.allSalesData;

    // Helper to find max date
    const findMax = (dataset) => {
        if (!dataset) return null;
        let max = 0;
        const len = dataset.length;
        const isColumnar = dataset instanceof window.Utils.ColumnarDataset;

        // Check only last few items assuming ordered by date, or sample
        // Actually best to check all if small, but data might be large.
        // Assuming data is sorted by date ascending from backend query:
        // .order('dtped', { ascending: true })
        // So last item should have max date.

        let lastItem;
        if (isColumnar) {
            // Columnar might not be sorted by date if not explicitly requested, but Data.js says order(pk)
            // Let's scan last 50 items just in case
            const start = Math.max(0, len - 50);
            for (let i = start; i < len; i++) {
                const val = dataset.get(i).DTPED;
                const d = window.Utils.parseDate(val);
                if (d && d.getTime() > max) max = d.getTime();
            }
        } else {
            const start = Math.max(0, len - 50);
            for (let i = start; i < len; i++) {
                const val = dataset[i].DTPED;
                const d = window.Utils.parseDate(val);
                if (d && d.getTime() > max) max = d.getTime();
            }
        }
        return max > 0 ? new Date(max) : null;
    };

    const d1 = findMax(history);
    const d2 = findMax(sales);

    if (d1 && d2) lastDate = d1 > d2 ? d1 : d2;
    else if (d1) lastDate = d1;
    else if (d2) lastDate = d2;
    else lastDate = new Date(); // Fallback to now

    window.AppState.lastSaleDate = lastDate;

    // Calculate Working Days
    // Simplified logic: assume standard month
    const today = lastDate;
    const year = today.getFullYear();
    const month = today.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let workingDays = 0;
    let passedDays = 0;

    for (let i = 1; i <= daysInMonth; i++) {
        const d = new Date(year, month, i);
        const day = d.getDay();
        if (day !== 0) { // Exclude Sundays
            workingDays++;
            if (i <= today.getDate()) passedDays++;
        }
    }

    window.AppState.maxWorkingDaysStock = workingDays;
    window.AppState.passedWorkingDaysCurrentMonth = passedDays;

    console.log("Global State Calculated:", { lastDate, workingDays, passedDays });
};

window.App.renderView = function(viewName) {
    console.log("Rendering View:", viewName);
    
    // Hide all views
    const views = [
        'main-dashboard',
        'city-view',
        'comparison-view',
        'goals-view',
        'wallet-view',
        'coverage-view',
        'history-view',
        'clientes-view',
        'produtos-view',
        'mix-view',
        'innovations-month-view',
        'consultas-view' // Added queries view
    ];

    views.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });

    // Show Target
    let targetId = '';
    switch(viewName) {
        case 'dashboard': targetId = 'main-dashboard'; break;
        case 'cidades': targetId = 'city-view'; break;
        case 'comparativo': targetId = 'comparison-view'; break;
        case 'goals': targetId = 'goals-view'; break;
        case 'wallet': targetId = 'wallet-view'; break;
        case 'cobertura': targetId = 'coverage-view'; break;
        case 'history': targetId = 'history-view'; break;
        case 'clientes': targetId = 'clientes-view'; break;
        case 'produtos': targetId = 'produtos-view'; break;
        case 'mix': targetId = 'mix-view'; break;
        case 'inovacoes-mes': targetId = 'innovations-month-view'; break;
        case 'consultas': targetId = 'consultas-view'; break;
        default: targetId = 'main-dashboard';
    }

    const el = document.getElementById(targetId);
    if (el) el.classList.remove('hidden');

    // Trigger Specific Render Logic
    if (viewName === 'dashboard') {
        if (window.App.Dashboard) window.App.Dashboard.render();
    } else if (viewName === 'cidades') {
        if (window.App.City) window.App.City.render();
    } else if (viewName === 'comparativo') {
        if (window.App.Comparison) window.App.Comparison.render();
    } else if (viewName === 'cobertura') {
        if (window.App.Coverage) window.App.Coverage.render();
    } else if (viewName === 'mix') {
        if (window.App.Mix) window.App.Mix.render();
    } else if (viewName === 'inovacoes-mes') {
        if (window.App.Innovations) window.App.Innovations.render();
    } else if (viewName === 'goals') {
        if (window.App.Goals) window.App.Goals.calculateGoalsMetrics();
    } else if (viewName === 'history') {
        if (window.renderHistoryView) window.renderHistoryView();
    } else if (viewName === 'clientes') {
        if (window.renderClientView) window.renderClientView();
    } else if (viewName === 'produtos') {
        if (window.renderProductView) window.renderProductView();
    }
};

// Alias for legacy HTML onclicks
window.renderView = window.App.renderView;

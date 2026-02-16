window.App = window.App || {};

window.App.init = function() {
    console.log("App Initializing...");
    
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

window.App.renderView = function(viewName) {
    console.log("Rendering View:", viewName);
    
    // Hide all views
    const views = ['main-dashboard', 'city-view', 'comparison-view', 'goals-view', 'wallet-view', 'coverage-view', 'history-view', 'clientes-view', 'produtos-view'];
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
        case 'wallet': targetId = 'wallet-view'; break; // Helper alias if needed
        case 'cobertura': targetId = 'coverage-view'; break;
        case 'history': targetId = 'history-view'; break;
        case 'clientes': targetId = 'clientes-view'; break;
        case 'produtos': targetId = 'produtos-view'; break;
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

window.App = window.App || {};
window.App.Products = {
    render: function(filter = '') {
        const container = document.getElementById('produtos-list-container');
        const countEl = document.getElementById('produtos-count');
        const searchInput = document.getElementById('produtos-search');
        if (!container) return;

        // Bind Search once
        if (searchInput && !searchInput._bound) {
            searchInput.addEventListener('input', (e) => this.render(e.target.value));
            searchInput._bound = true;
        }

        // Use global embeddedData as fallback or AppState property if mapped
        const prodList = (window.embeddedData && window.embeddedData.products) ? window.embeddedData.products : [];

        const filtered = prodList.filter(p => {
            if (!filter) return true;
            const f = filter.toLowerCase();
            return (p.descricao || '').toLowerCase().includes(f) || (String(p.code || '')).includes(f);
        });
    });

    // Mobile Menu Toggle
    const mobileMenuBtn = document.getElementById('mobile-menu-toggle');
    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenuBtn && mobileMenu) {
        mobileMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            mobileMenu.classList.toggle('hidden');
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!mobileMenu.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
                mobileMenu.classList.add('hidden');
            }
        });
    }

    // Bind Mobile Navigation
    const mobileLinks = document.querySelectorAll('.mobile-nav-link');
    mobileLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const target = e.target.getAttribute('data-target');
            if (target) {
                window.App.renderView(target);
                if (mobileMenu) mobileMenu.classList.add('hidden');
            }
        });
    });

    // Initial View
    window.App.renderView('dashboard');
};

window.App.renderView = function(viewName) {
    console.log("Rendering View:", viewName);
    
    // Hide all views
    const views = ['main-dashboard', 'city-view', 'comparison-view', 'goals-view', 'wallet-view', 'coverage-view', 'history-view', 'clientes-view', 'produtos-view', 'mix-view', 'innovations-month-view'];
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
        case 'mix': targetId = 'mix-view'; break;
        case 'inovacoes-mes': targetId = 'innovations-month-view'; break;
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

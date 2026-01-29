import { initAuth } from './modules/auth.js';
import { initializeOptimizedDataStructures } from './modules/data.js';
import { initUI, navigateTo, renderTable } from './modules/ui.js';
import { initCharts } from './modules/charts.js';
import { setupHierarchyFilters, resolveUserContext } from './modules/filters.js';
import { initViewLogic } from './modules/view_controller.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log("[Main] Starting application...");

        // 1. Initialize Auth & Data Loading
        const data = await initAuth();

        if (!data) {
            console.error("No data loaded.");
            return;
        }

        console.log("[Main] Data loaded, initializing logic...");

        // 2. Initialize Data Structures
        initializeOptimizedDataStructures(data);

        // 3. Resolve User Context
        resolveUserContext();

        // 4. Initialize Charts (Register plugins)
        initCharts();

        // 5. Initialize UI (Listeners, Views)
        initUI();

        // 6. Initialize View Controller (Legacy Logic)
        initViewLogic();

        // 7. Initial Render
        // Check URL params
        const urlParams = new URLSearchParams(window.location.search);
        const targetPage = urlParams.get('ir_para');
        navigateTo(targetPage || 'dashboard');

    } catch (e) {
        console.error("[Main] Application Crash:", e);
        alert("Erro fatal ao iniciar aplicação: " + e.message);
    }
});

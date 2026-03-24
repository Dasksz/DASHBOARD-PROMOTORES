const fs = require('fs');
let html = fs.readFileSync('/app/index.html', 'utf8');

const targetStr = `                    <!-- Secondary Charts -->
                    <div class="flex flex-col gap-8">
                        <div class="w-full glass-panel p-2 rounded-2xl border border-slate-800/50 shadow-lg">
                            <h2 id="sales-by-person-title" class="text-lg font-bold text-white mb-2 text-center">Performance por Supervisor</h2>
                            <div id="salesByPersonChartContainer" class="relative h-40"></div>
                        </div>
                        <div class="w-full glass-panel p-2 rounded-2xl border border-slate-800/50 shadow-lg">
                            <h2 id="faturamentoPorFornecedorTitle" class="text-lg font-bold text-white mb-6 text-center">Share por Categoria</h2>
                            <div id="faturamentoPorFornecedorChartContainer" class="relative h-80"></div>
                        </div>
                    </div>`;

const replacement = `                    <!-- Secondary Charts -->
                    <div class="grid grid-cols-1 xl:grid-cols-2 gap-8">
                        <div class="flex flex-col gap-8">
                            <div class="w-full glass-panel p-2 rounded-2xl border border-slate-800/50 shadow-lg">
                                <h2 id="sales-by-person-title" class="text-lg font-bold text-white mb-2 text-center">Performance por Supervisor</h2>
                                <div id="salesByPersonChartContainer" class="relative h-40"></div>
                            </div>
                            <div class="w-full glass-panel p-2 rounded-2xl border border-slate-800/50 shadow-lg">
                                <h2 id="faturamentoPorFornecedorTitle" class="text-lg font-bold text-white mb-6 text-center">Share por Categoria</h2>
                                <div id="faturamentoPorFornecedorChartContainer" class="relative h-80"></div>
                            </div>
                        </div>
                        <div class="w-full glass-panel p-2 rounded-2xl border border-slate-800/50 shadow-lg flex flex-col">
                            <h2 id="metasChartTitle" class="text-lg font-bold text-white mb-6 text-center">Metas</h2>
                            <div id="metasChartContainer" class="relative flex-1 min-h-[400px]"></div>
                        </div>
                    </div>`;

if (html.includes(targetStr)) {
    html = html.replace(targetStr, replacement);
    fs.writeFileSync('/app/index.html', html, 'utf8');
    console.log("HTML patched successfully.");
} else {
    console.log("Target string not found in index.html");
}

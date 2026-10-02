// Verifica os três caminhos de renderização preservados após retirar KPIs locais.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../js/app/app.js'), 'utf8');
const between = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const makeElement = () => ({ innerHTML: '', textContent: '', classList: { add() {}, remove() {} } });
const elements = new Map();
const element = id => { if (!elements.has(id)) elements.set(id, makeElement()); return elements.get(id); };
const sample = [
  { DTPED: '2026-10-01', TIPOVENDA: '1', VLVENDA: 10, VLBONIFIC: 0, TOTPESOLIQ: 1, CODCLI: '1', CODSUPERVISOR: 'A' },
  { DTPED: '2026-09-29', TIPOVENDA: '1', VLVENDA: 5, VLBONIFIC: 0, TOTPESOLIQ: 1, CODCLI: '1', CODSUPERVISOR: 'A' }
];
let draws = 0;
const context = {
  Date, Map, Set, Array, Object, Number, String, Math,
  comparisonRenderId: 1, charts: {}, comparisonChartType: 'weekly', comparisonMonthlyMetric: 'faturamento',
  selectedComparisonTiposVenda: [], selectedHolidays: [], useTendencyComparison: false, adminViewMode: 'seller',
  lastSaleDate: new Date('2026-10-01T00:00:00Z'), QUARTERLY_DIVISOR: 3,
  weeklyComparisonChartContainer: makeElement(), monthlyComparisonChartContainer: makeElement(), comparisonChartTitle: makeElement(),
  document: { getElementById: element },
  window: { resolveDim: (_, key) => key || 'N/A', escapeHtml: value => String(value) },
  parseDate: s => s ? new Date(s) : null,
  getComparisonFilteredData: () => ({ currentSales: sample.slice(0, 1), historySales: sample.slice(1) }),
  runAsyncChunked: (rows, each, done, cancelled) => { for (const row of rows) { if (cancelled()) return; each(row); } if (!cancelled()) done(); },
  renderWeeklyComparisonAmChart: (labels, current, history) => { assert.equal(labels.length, current.length); assert.equal(current.length, history.length); draws++; },
  renderMonthlyComparisonAmChart: (labels, values) => { assert.equal(labels.length, values.length); draws++; }
};
vm.createContext(context);
vm.runInContext(
  between('        function isAlternativeMode(', '        // ---------------------------------------------') +
  between('        function getMonthWeeks(year, month)', '        function normalize(str)') +
  between('        function isHoliday(', '        function getWorkingDayIndex(') +
  between('        function renderComparisonLegacyCharts(', '        function getInnovationsMonthFilteredData'), context);
const k = { fat: 10, peso: 1, clients: 1, mixPepsico: 1, positivacaoSalty: 0, positivacaoFoods: 0, perdas: 0 };
for (const tendency of [false, true]) for (const type of ['weekly', 'monthly', 'daily']) {
  context.useTendencyComparison = tendency;
  context.comparisonChartType = type;
  context.renderComparisonLegacyCharts(1, { current: k, history: k });
}
assert.equal(draws, 6);
assert.match(element('weeklySummaryTableBody').innerHTML, /Total do Mês/);
console.log('Gráficos semanal, mensal e diário, com e sem tendência: OK');

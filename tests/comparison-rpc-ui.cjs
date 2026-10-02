const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../js/app/app.js'), 'utf8');
const begin = source.indexOf('        let comparisonRpcTimer =');
const end = source.indexOf('        function renderComparisonLegacyCharts(', begin);
const timers = new Map(), requests = [], renders = [], chartRenders = [];
let timerId = 0;
const button = { addEventListener: (_, fn) => { button.retry = fn; } };
const container = { innerHTML: 'cartões existentes', style: {}, setAttribute: (key, value) => { container[key] = value; }, querySelector: () => null, appendChild: node => { container.alert = node; } };
const alertNode = () => ({ setAttribute() {}, querySelector: () => button, remove() {} });
const context = {
  AbortController, Date, Set, Array, Number, Error,
  console: { error() {} }, comparisonRenderId: 0, selectedHolidays: [], useTendencyComparison: false,
  lastSaleDate: new Date('2026-10-01T00:00:00Z'),
  setTimeout: (fn, delay) => { const id = ++timerId; timers.set(id, { fn, delay }); return id; },
  clearTimeout: id => timers.delete(id),
  document: { getElementById: () => container, createElement: alertNode },
  getComparisonSelectionFilters: () => ({ clientCodes: new Set(['1']), supplier: new Set(), product: new Set(), tipoVenda: new Set(), filial: '05', city: '', pasta: '' }),
  renderKpiCards: cards => renders.push(cards),
  renderComparisonLegacyCharts: (id, kpis) => chartRenders.push({ id, kpis }),
  window: { supabaseClient: { rpc(name, args) {
    assert.equal(name, 'get_comparison_kpis_v1');
    const req = { args };
    requests.push(req);
    return { abortSignal(signal) { req.signal = signal; return new Promise(resolve => { req.resolve = resolve; }); } };
  } } }
};
vm.createContext(context);
vm.runInContext(source.slice(begin, end), context);
const launch = () => {
  const timer = [...timers].find(([,t]) => t.delay === 150);
  assert.ok(timer); timers.delete(timer[0]); return timer[1].fn();
};
const flushCharts = () => { for (const [id, t] of timers) if (t.delay === 0) { timers.delete(id); t.fn(); } };
const payload = n => ({ schema_version: 1, kpis: Object.fromEntries(['current','history'].map(s => [s, Object.fromEntries(['fat','peso','clients','ticket','mixPepsico','positivacaoSalty','positivacaoFoods','perdas'].map(k => [k,n]))])) });
(async () => {
  context.updateComparisonView();
  context.updateComparisonView();
  assert.equal([...timers.values()].filter(t => t.delay === 150).length, 1, 'debounce');
  assert.equal(container.innerHTML, 'cartões existentes', 'cartões preservados durante a carga');
  const first = launch();
  context.updateComparisonView();
  assert.equal(requests[0].signal.aborted, true, 'cancelamento');
  const second = launch();
  flushCharts();
  assert.equal(chartRenders.length, 1, 'gráficos não aguardam RPC');
  requests[0].resolve({ data: payload(1), error: null }); await first;
  assert.equal(renders.length, 0, 'resposta antiga foi descartada');
  requests[1].resolve({ data: payload(2), error: null }); await second;
  assert.equal(renders.length, 1); assert.equal(renders[0].length, 8);
  assert.equal(renders[0][0].current, 2); assert.equal(renders[0][1].current, 0.002);
  assert.equal(chartRenders.length, 1); assert.equal(container['aria-busy'], 'false');
  context.updateComparisonView(); const third = launch(); flushCharts();
  requests[2].resolve({ data: null, error: { message: 'timeout' } }); await third;
  assert.match(container.alert.innerHTML, /Tentar novamente/); assert.equal(renders.length, 1);
  button.retry(); const fourth = launch(); flushCharts();
  requests[3].resolve({ data: payload(3), error: null }); await fourth;
  assert.equal(renders.length, 2); assert.equal(timers.size, 0, 'timers limpos');
  context.updateComparisonView(); const fifth = launch(); flushCharts();
  const invalid = payload(4); delete invalid.kpis.current.fat;
  requests[4].resolve({ data: invalid, error: null }); await fifth;
  assert.equal(renders.length, 2, 'resposta inválida não vira zero');
  console.log('UI: debounce, cancelamento, descarte de resposta antiga, oito cartões, erro, retry e validação OK');
})().catch(error => { console.error(error); process.exitCode = 1; });

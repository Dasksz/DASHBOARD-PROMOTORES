const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('js/app/app.js', 'utf8');
const start = source.indexOf('function getMetaRealizadoFilteredData()');
const end = source.indexOf('function renderMetaRealizadoTable(', start);
const clients = [
  { codigo_cliente: '9846', rca1: '172' },
  { codigo_cliente: '9181', rca1: '172' },
  { codigo_cliente: '12033', rca1: '78' },
  { codigo_cliente: '12097', rca1: '78' },
  { codigo_cliente: '160', rca1: '294' }
];
const names = new Map([['172', 'BETO'], ['78', 'VANESSIA'], ['294', 'KALINE']]);
function calculate({ scoped = clients, goals = new Map(), sales = [], selected = [] } = {}) {
  const ctx = {
    window: { userRole: 'promotor7', SUPPLIER_CODES: { ELMA: ['707', '708', '752'], FOODS: ['1119'], VIRTUAL_LIST: [] }, resolveDim: (_, code) => names.get(code) },
    getMetaRealizadoGoalMaps: () => ({ clients: goals, sellers: new Map() }),
    getMetaRealizadoPeriodSource: () => ({ data: sales }),
    getMetaRealizadoPeriodDate: () => new Date('2026-11-04T00:00:00Z'),
    selectedMetaRealizadoSuppliers: new Set(), currentMetaRealizadoPasta: 'PEPSICO',
    selectedMetaRealizadoVendedores: new Set(selected), selectedMetaRealizadoSupervisors: new Set(),
    adminViewMode: selected.length ? 'seller' : 'promotor',
    hierarchyState: { 'meta-realizado': { coords: new Set(), cocoords: new Set(), promotors: new Set() } },
    sellerDetailsMap: new Map([...names].map(([code, name]) => [code, { name }])),
    optimizedData: { rcaNameByCode: names, clientsMap: new Map(clients.map(c => [c.codigo_cliente, c])) },
    getMetaRealizadoGoalKeys: () => ['707'],
    allClientsData: clients,
    getHierarchyFilteredClients: () => scoped,
    isGarbageSeller: name => !name,
    normalizeKey: String, parseDate: value => new Date(value),
    matchesMetaRealizadoSupplier: () => true,
    getMonthWeeksDistribution: () => ({ weeks: [{ start: new Date('2026-11-01'), end: new Date('2026-11-30') }] }),
    ColumnarDataset: class {},
  };
  vm.createContext(ctx);
  vm.runInContext(source.slice(start, end) + '\nresult = getMetaRealizadoFilteredData();', ctx);
  return ctx.result;
}
test('Richard sees both zero sellers without fabricating goals or sales', () => {
  const result = calculate();
  assert.deepEqual([...result.goalsBySeller.keys()], ['BETO', 'VANESSIA', 'KALINE']);
  for (const value of result.goalsBySeller.values()) assert.equal(value.totalFat + value.totalVol + value.totalPos, 0);
  assert.equal(result.salesBySeller.size, 0);
});
test('scoped portfolios and explicit seller filters never add other sellers', () => {
  assert.deepEqual([...calculate({ scoped: clients.slice(0, 2) }).goalsBySeller.keys()], ['BETO']);
  assert.deepEqual([...calculate({ selected: ['78'] }).goalsBySeller.keys()], ['VANESSIA']);
});
test('existing goals and sales are conserved when zero sellers become visible', () => {
  const goals = new Map([['160', new Map([['707', { fat: 100, vol: 5 }]])]]);
  const sales = [{ CODCLI: '160', CODUSUR: '294', DTPED: '2026-11-04', CODFOR: '707', TIPOVENDA: '1', OBSERVACAOFOR: 'PEPSICO', VLVENDA: 50, TOTPESOLIQ: 2 }];
  const result = calculate({ goals, sales });
  assert.equal(result.goalsBySeller.get('KALINE').totalFat, 100);
  assert.equal(result.goalsBySeller.get('KALINE').totalPos, 1);
  assert.equal(result.salesBySeller.get('KALINE').totalFat, 50);
  assert.equal(result.salesBySeller.get('KALINE').totalPos, 1);
  assert.equal(result.salesBySeller.size, 1);
});

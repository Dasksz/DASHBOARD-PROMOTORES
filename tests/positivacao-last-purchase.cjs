const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../js/app/app.js'), 'utf8');
const utils = fs.readFileSync(path.join(__dirname, '../js/app/utils.js'), 'utf8');
const section = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const fields = {
 'positivacao-last-purchase-start': { value: '' },
 'positivacao-last-purchase-end': { value: '' },
 'positivacao-last-purchase-undated': { checked: false },
 'positivacao-last-purchase-error': { classList: { toggle() {} } },
 'positivacao-promotor-filter-text': { textContent: 'Ericarlos' },
 'positivacao-city-filter': { value: '' }
};
let pdfRows, pdfName; const pdfText = [];
const ctx = {
 console, Date, Map, Set, document: { getElementById: id => fields[id] || null },
 window: { showToast() {}, jspdf: { jsPDF: class {
  internal = { getNumberOfPages: () => 1, pageSize: { width: 210, height: 297 } };
  setFontSize() {} setTextColor() {} text(value) { pdfText.push(value); }
  splitTextToSize(value) { return [value]; } setPage() {}
  autoTable(options) { pdfRows = options.body; } save(name) { pdfName = name; }
 } } },
 hierarchyState: {}, positivacaoRenderId: 0, positivacaoDataForExport: {},
 positivacaoActiveState: { page: 3, limit: 50 }, positivacaoInactiveState: { page: 3, limit: 50 },
 positivacaoActiveDetailTableBody: null, positivacaoInactiveDetailTableBody: null,
 getSkeletonRows: () => '', renderPositivacaoActiveTable() {}, renderPositivacaoInactiveTable() {},
 lastSaleDate: new Date('2026-10-22T00:00:00Z'),
 runAsyncChunked: (list, each, done) => { list.forEach(each); done(); },
 formatDate: value => value ? String(value) : 'N/A'
};
vm.createContext(ctx);
// Exercise the app's real date parser, including Brazilian and Excel dates.
const parser = utils.slice(utils.indexOf('    window.parseDate = function'), utils.indexOf('    window.parseDate = function') + 8000);
const parserEnd = parser.indexOf('\n    };');
vm.runInContext('const dateCache = new Map();\n' + parser.slice(0, parserEnd + 7), ctx);
ctx.parseDate = ctx.window.parseDate;
vm.runInContext(section('        function getPositivacaoLastPurchaseFilters()', '        function renderPositivacaoActiveTable()'), ctx);
vm.runInContext(section('        function exportClientsPDF(', '        function renderCalendar('), ctx);
const clients = [
 { 'Código': 'old', ultimaCompra: '01/01/2026' },
 { 'Código': 'start', ultimaCompra: '2026-09-01' },
 { 'Código': 'end', 'Data da Última Compra': '30/09/2026' },
 { 'Código': 'new', ultimaCompra: '2026-10-01' },
 { 'Código': 'unknown' }, { 'Código': 'invalid', ultimaCompra: 'N/A' }
];
const codes = rows => Array.from(rows, row => row['Código']);
assert.deepEqual(codes(ctx.filterPositivacaoInactiveClients(clients, { start: '2026-09-01', end: '2026-09-30' })), ['start', 'end']);
assert.deepEqual(codes(ctx.filterPositivacaoInactiveClients(clients, { end: '2026-09-01' })), ['old', 'start']);
assert.deepEqual(codes(ctx.filterPositivacaoInactiveClients(clients, { start: '2026-09-30' })), ['end', 'new']);
assert.equal(ctx.filterPositivacaoInactiveClients(clients, {}).length, 6);
assert.equal(ctx.filterPositivacaoInactiveClients(clients, { end: '2026-09-01', includeUndated: true }).length, 4);
assert.equal(ctx.filterPositivacaoInactiveClients(clients, { start: '2026-10-01', end: '2026-09-01', includeUndated: true }).length, 0);
assert.equal(ctx.getPositivacaoLastPurchaseKey({ ultimaCompra: 45931 }), '2025-10-01');
// Drive the actual view update with an already-restricted hierarchy/city/supplier dataset.
const many = Array.from({ length: 65 }, (_, i) => ({ 'Código': 'eligible-' + i, ultimaCompra: '2026-09-15', nomeCliente: 'Loja ' + i }));
ctx.getPositivacaoFilteredData = () => ({ clients: [...many, { 'Código': 'recent', ultimaCompra: '2026-10-20' }, { 'Código': 'active', ultimaCompra: '2026-08-01' }, { 'Código': 'undated' }], sales: [{ CODCLI: 'active', VLVENDA: 100, PASTA: 'PEPSICO' }] });
fields['positivacao-last-purchase-end'].value = '2026-09-30';
ctx.updatePositivacaoView();
assert.equal(ctx.positivacaoInactiveState.page, 1);
assert.equal(ctx.positivacaoInactiveState.data.length, 65);
assert.equal(ctx.positivacaoDataForExport.inactive, ctx.positivacaoInactiveState.data);
assert.deepEqual(codes(ctx.positivacaoDataForExport.active), ['active']);
ctx.exportClientsPDF(ctx.positivacaoDataForExport.inactive, 'Inativos', 'clientes_inativos', false, { preserveOrder: true, filterLabel: ctx.getPositivacaoLastPurchaseFilterLabel(), filterPrefix: 'positivacao' });
assert.equal(pdfRows.length, 66); // All 65 matching clients, plus total, beyond a 50-row page.
assert.deepEqual(Array.from(pdfRows.slice(0, -1), row => row[0]), codes(ctx.positivacaoInactiveState.data));
assert.equal(pdfRows.at(-1)[1].content, '65');
assert(pdfName.startsWith('clientes_inativos_'));
assert(pdfText.flat().some(value => value.includes('30/09/2026')));
assert(pdfText.includes('Promotor: Ericarlos'));
fields['positivacao-last-purchase-undated'].checked = true; ctx.updatePositivacaoView();
assert.equal(ctx.positivacaoDataForExport.inactive.length, 66);
fields['positivacao-last-purchase-start'].value = '2026-10-01'; ctx.updatePositivacaoView();
assert.equal(ctx.positivacaoDataForExport.inactive.length, 0);
fields['positivacao-last-purchase-start'].value = ''; fields['positivacao-last-purchase-end'].value = ''; ctx.updatePositivacaoView();
assert.equal(ctx.positivacaoDataForExport.inactive.length, 67);
// Async stale renders must never replace a newer filter's export snapshot.
let callbacks = [];
ctx.runAsyncChunked = (list, each, done) => { list.forEach(each); callbacks.push(done); };
fields['positivacao-last-purchase-end'].value = '2026-09-30'; ctx.updatePositivacaoView();
fields['positivacao-last-purchase-end'].value = '2026-08-31'; ctx.updatePositivacaoView();
assert.equal(ctx.positivacaoDataForExport.inactive.length, 0);
callbacks[1](); callbacks[0]();
assert.deepEqual(codes(ctx.positivacaoDataForExport.inactive), ['undated']);
console.log('PASS: date boundaries, missing dates, filtering, active clients, pagination, PDF parity and stale renders');

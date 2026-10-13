const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const init = fs.readFileSync('js/init.js', 'utf8');
const filterStart = init.indexOf('// B. Filter Detailed (Sales)');
const filterEnd = init.indexOf('// D. Filter Orders', filterStart);
const filter = init.slice(filterStart, filterEnd);
const app = fs.readFileSync('js/app/app.js', 'utf8');
const normalizeStart = app.indexOf('function normalizePastaInData');
const normalizeEnd = app.indexOf('function sanitizeData', normalizeStart);

function contextFor(detailed, history) {
    const context = vm.createContext({
        window: { resolveSupplierPastaFromDim: () => 'PEPSICO' },
        detailed, history,
        allowedCurrentCodes: new Set(['10']),
        allowedHistoryCodes: new Set(['10']),
        normalizeKey: String
    });
    vm.runInContext(fs.readFileSync('js/app/utils.js', 'utf8'), context);
    vm.runInContext('const ColumnarDataset = window.ColumnarDataset;', context);
    vm.runInContext(app.slice(normalizeStart, normalizeEnd), context);
    return context;
}

test('coordinator can filter again after supplier pasta enrichment without corrupting cached columns', () => {
    const source = () => ({ columns: ['CODCLI', 'CODFOR', 'VLVENDA'], values: {
        CODCLI: ['10', '20'], CODFOR: ['1', '1'], VLVENDA: [0, 99]
    }, length: 2 });
    const detailed = source();
    const history = source();
    const context = contextFor(detailed, history);
    vm.runInContext(`let filteredDetailed, filteredHistory; { ${filter} }
        const view = new ColumnarDataset(filteredDetailed);
        normalizePastaInData(view);
        const historicalView = new ColumnarDataset(filteredHistory);
        normalizePastaInData(historicalView);`, context);
    assert.equal(detailed.columns.includes('OBSERVACAOFOR'), false);
    assert.equal(history.columns.includes('OBSERVACAOFOR'), false);
    assert.equal(detailed.values.OBSERVACAOFOR, undefined);
    assert.equal(vm.runInContext('filteredDetailed.columns.includes("OBSERVACAOFOR")', context), false);
    vm.runInContext(`{ ${filter} }`, context);
    assert.equal(vm.runInContext('filteredDetailed.length', context), 1);
    assert.equal(vm.runInContext('filteredDetailed.values.VLVENDA[0]', context), 0);
});

test('previously inconsistent cache retains wallet filtering and missing cell alignment', () => {
    const source = () => ({ columns: ['CODCLI', 'OBSERVACAOFOR'],
        values: { CODCLI: ['20', '10'] }, length: 2 });
    const context = contextFor(source(), source());
    vm.runInContext(`let filteredDetailed, filteredHistory; { ${filter} }`, context);
    assert.equal(vm.runInContext('filteredDetailed.values.CODCLI.join()', context), '10');
    assert.equal(vm.runInContext('filteredHistory.values.CODCLI.join()', context), '10');
    assert.equal(vm.runInContext('filteredDetailed.values.OBSERVACAOFOR.length', context), 1);
    assert.equal(vm.runInContext('filteredDetailed.values.OBSERVACAOFOR[0]', context), null);
});

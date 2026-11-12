const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '../js/app/app.js'), 'utf8');
const start = app.indexOf('        function parseGoalsSvStructure(');
const end = app.indexOf('        // --- Event Listeners for Import ---', start);
assert.ok(start >= 0 && end > start);
const context = vm.createContext({
    window: {},
    console: {log() {}, warn() {}},
    optimizedData: {
        rcaNameByCode: new Map([['53', 'BALCAO']]),
        rcaCodeByName: new Map([['BALCAO', '53']]),
        rcasBySupervisor: new Map([['BALCAO', ['53']]])
    }
});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/app/utils.js'), 'utf8'), context);
vm.runInContext(app.slice(start, end), context);
const fixture = (name, code = '53') => [
    '\t\tEXTRUSADOS\tGERAL',
    '\t\tFATURAMENTO\tFATURAMENTO',
    'CÓD\tVENDEDOR\tAjuste\tMeta',
    `${code}\t${name}\t6.229,61\t26.500,00`
].join('\n');
for (const label of ['BALCAO (BH FEIRA)', 'Balcão (BH Feira)', 'BALCAO']) {
    const rows = context.parseGoalsSvStructure(fixture(label));
    assert.equal(rows.find(row => row.category === '707' && row.seller === 'BALCAO')?.val, 6229.61);
    assert.equal(rows.find(row => row.category === 'pepsico_all' && row.seller === 'BALCAO')?.val, 26500);
}
assert.equal(context.parseGoalsSvStructure(fixture('BALCAO (BH FEIRA)', '')).length, 0);
assert.equal(context.parseGoalsSvStructure(fixture('BALCAO', '999')).length, 0);

if (process.argv[2]) {
    const rows = context.parseGoalsSvStructure(fs.readFileSync(process.argv[2], 'utf8')).filter(row => row.seller === 'BALCAO');
    const leaves = rows.filter(row => row.type === 'rev' && context.window.SUPPLIER_CODES.ALL_GOALS.includes(row.category));
    assert.equal(Math.round(leaves.reduce((sum, row) => sum + row.val, 0) * 100), 2650000);
    assert.equal(rows.find(row => row.type === 'rev' && row.category === 'pepsico_all')?.val, 26500);
}
console.log('PASS: BH import normalizes the RCA 53 alias, retains the explicit goal, and skips uncoded Balcão rows.');

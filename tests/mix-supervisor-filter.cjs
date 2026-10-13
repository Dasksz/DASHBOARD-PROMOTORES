const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('mix supervisor opens once, closes, and applies selection after repeated setup', () => {
    const elements = new Map();
    const element = id => {
        if (!elements.has(id)) {
            const classes = new Set(id.endsWith('dropdown') ? ['hidden'] : []);
            const listeners = {};
            elements.set(id, {
                classList: { contains: c => classes.has(c), add: c => classes.add(c), remove: c => classes.delete(c), toggle: c => classes.has(c) ? classes.delete(c) : classes.add(c) },
                addEventListener: (type, fn) => (listeners[type] ||= []).push(fn),
                fire: (type, event = { stopPropagation() {} }) => (listeners[type] || []).forEach(fn => fn(event))
            });
        }
        return elements.get(id);
    };
    const document = { getElementById: element, addEventListener() {} };
    const context = vm.createContext({ window: {}, document });
    const utils = fs.readFileSync('js/app/utils.js', 'utf8');
    const start = utils.indexOf('window.setupGenericFilterHandlers = function');
    const end = utils.indexOf('\n    };', start) + '\n    };'.length;
    vm.runInContext(utils.slice(start, end), context);
    const supervisors = new Set();
    const sellers = new Set(['Seller']);
    let changes = 0;
    const setup = () => context.window.setupGenericFilterHandlers('mix', supervisors, sellers, () => {}, () => {}, () => changes++);
    setup();
    setup();
    // Include any additional Mix supervisor binding from the view initialization.
    const app = fs.readFileSync('js/app/app.js', 'utf8');
    const legacyStart = app.indexOf("const mixSupervisorBtn = document.getElementById('mix-supervisor-filter-btn');");
    if (legacyStart >= 0) vm.runInContext(app.slice(legacyStart, app.indexOf('const mixTipoVendaBtn', legacyStart)), context);
    const button = element('mix-supervisor-filter-btn');
    const dropdown = element('mix-supervisor-filter-dropdown');
    button.fire('click');
    assert.equal(dropdown.classList.contains('hidden'), false);
    assert.equal(element('mix-supervisor-filter-wrapper').classList.contains('z-50'), true);
    dropdown.fire('change', { target: { type: 'checkbox', value: 'Supervisor A', checked: true } });
    assert.equal(supervisors.has('Supervisor A'), true);
    assert.equal(sellers.size, 0);
    assert.equal(changes, 1);
    button.fire('click');
    assert.equal(dropdown.classList.contains('hidden'), true);
    button.fire('click');
    assert.equal(dropdown.classList.contains('hidden'), false);
});

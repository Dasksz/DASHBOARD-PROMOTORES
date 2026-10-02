const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../js/app/app.js'), 'utf8');
const start = source.indexOf("                updateStatus('Atualizando resumos do painel...', 98);");
const end = source.indexOf("                setTimeout(() => statusContainer", start);
assert.ok(start >= 0 && end > start);
const snippet = source.slice(start, end);
async function check(response, succeeds) {
  const events = [];
  let resolve;
  const pending = new Promise(r => { resolve = r; });
  const context = vm.createContext({
    updateStatus: text => events.push(text),
    window: { supabaseClient: { rpc: name => { assert.equal(name, 'refresh_dashboard_summaries_v1'); return pending; } }, showToast: type => events.push(type) }
  });
  const run = vm.runInContext(`(async () => { ${snippet} })()`, context);
  assert.deepEqual(events, ['Atualizando resumos do painel...']);
  resolve(response);
  if (succeeds) { await run; assert.ok(events.includes('success')); }
  else { await assert.rejects(run); assert.ok(!events.includes('success')); }
}
(async () => {
  await check({ data: { status: 'refreshed' } }, true);
  await check({ data: { status: 'current' } }, true);
  await check({ data: { status: 'busy' } }, false);
  await check({ data: null }, false);
  await check({ error: new Error('timeout') }, false);
  console.log('Importação aguarda resumos e não informa sucesso em busy/erro/resposta vazia: OK');
})().catch(error => { console.error(error); process.exitCode = 1; });

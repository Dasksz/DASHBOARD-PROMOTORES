// Comparação independente da RPC com as regras numéricas do frontend legado.
// node tests/comparison-kpis-parity.cjs dataset.json results.json
const fs = require('node:fs');
const assert = require('node:assert/strict');
const dataset = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const { cases, results } = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const clients = new Map(dataset.clients.map(c => [c.codigo_cliente, c]));
const products = new Map(dataset.products.map(p => [p.codigo, p]));
const suppliers = new Map(dataset.suppliers.map(p => [p.codigo, p]));
const norm = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
const groups = (sales, keyFn) => {
  const out = new Map();
  for (const s of sales) { const k = keyFn(s); if (!out.has(k)) out.set(k, []); out.get(k).push(s); }
  return out;
};
const sum = (rows, fn) => rows.reduce((v, s) => v + fn(s), 0);
function reference(f) {
  const types = f.types || [];
  const alt = types.length > 0 && !types.includes('1') && !types.includes('9');
  const val = s => Number(alt ? s.vlbonific : s.vlvenda) || 0;
  const desc = s => products.get(s.produto)?.descricao || `Produto ${s.produto}`;
  const filtered = dataset.sales.filter(s => {
    const c = clients.get(s.codcli);
    const df = suppliers.get(s.codfor);
    let pasta = s.observacaofor;
    if (!pasta || ['0', '00', 'N/A'].includes(pasta)) pasta = df?.pasta || ((df?.nome || s.codfor).toUpperCase().includes('PEPSICO') ? 'PEPSICO' : 'MULTIMARCAS');
    const d = desc(s).toUpperCase();
    const virtual = s.codfor === '1119' ? (d.includes('TODDYNHO') ? '1119_TODDYNHO' : d.includes('TODDY') ? '1119_TODDY' : d.includes('QUAKER') || d.includes('KEROCOCO') ? '1119_QUAKER_KEROCOCO' : null) : null;
    return f.client_codes.includes(s.codcli) && (!f.filial || f.filial === 'ambas' || f.filial === s.filial) &&
      (!f.city || f.city === (c?.cidade || 'N/A').toLowerCase()) && (!f.pasta || f.pasta === pasta) &&
      (!f.products?.length || f.products.includes(s.produto)) &&
      (!f.suppliers?.length || f.suppliers.includes(s.codfor) || f.suppliers.includes(virtual));
  });
  function monthMetrics(rows) {
    let mixSum = 0, mixClients = 0, salty = 0, foods = 0, positives = 0;
    for (const [, cr] of groups(rows.filter(s => s.codcli), s => s.codcli)) {
      if (sum(cr, val) >= 1) positives++;
      let mix = 0;
      const sc = new Set(), fc = new Set();
      for (const [, pr] of groups(cr, s => s.produto)) {
        if (sum(pr, val) < 1) continue;
        if (['707', '708', '752'].includes(pr[0].codfor)) mix++;
        for (const cat of ['CHEETOS', 'DORITOS', 'FANDANGOS', 'RUFFLES', 'TORCIDA']) if (norm(desc(pr[0])).includes(cat)) sc.add(cat);
        for (const cat of ['TODDYNHO', 'TODDY ', 'QUAKER', 'KEROCOCO']) if (norm(desc(pr[0])).includes(cat)) fc.add(cat);
      }
      if (mix > 0) { mixSum += mix; mixClients++; }
      if (sc.size === 5) salty++;
      if (fc.size === 4) foods++;
    }
    return { clients: positives, mixPepsico: mixClients ? mixSum / mixClients : 0, positivacaoSalty: salty, positivacaoFoods: foods };
  }
  const out = {};
  for (const source of ['current', 'history']) {
    const rows = filtered.filter(s => s.source === source);
    const sales = rows.filter(s => (!types.length || types.includes(s.tipovenda)) && (alt || ['1','9'].includes(s.tipovenda)));
    const losses = rows.filter(s => s.tipovenda === '5' && !/AMERICANAS|BH/.test((clients.get(s.codcli)?.ramo || '').toUpperCase()));
    let k;
    if (source === 'current') k = monthMetrics(sales);
    else {
      k = { clients: 0, mixPepsico: 0, positivacaoSalty: 0, positivacaoFoods: 0 };
      const months = groups(sales.filter(s => s.dtped), s => s.dtped.slice(0, 7));
      for (const month of [...months.keys()].sort().slice(-3)) {
        const mk = monthMetrics(months.get(month));
        for (const key of Object.keys(k)) k[key] += mk[key] / 3;
      }
    }
    const divisor = source === 'current' ? 1 : 3;
    Object.assign(k, { fat: sum(sales, val) / divisor, peso: sum(sales, s => Number(s.totpesoliq) || 0) / divisor, perdas: sum(losses, s => Number(s.vlbonific) || 0) / divisor });
    if (source === 'current' && f.tendency) {
      const ref = new Date(f.reference_date + 'T00:00:00Z');
      let total = 0, passed = 0;
      for (let d = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1)); d.getUTCMonth() === ref.getUTCMonth(); d.setUTCDate(d.getUTCDate() + 1)) {
        if (d.getUTCDay() < 1 || d.getUTCDay() > 5 || f.holidays?.includes(d.toISOString().slice(0,10))) continue;
        total++; if (d <= ref) passed++;
      }
      passed = passed || 1;
      if (passed < total) {
        const ratio = total / passed;
        for (const key of ['fat','peso','perdas']) k[key] *= ratio;
        for (const key of ['clients','positivacaoSalty','positivacaoFoods']) k[key] = Math.round(k[key] * ratio);
      }
    }
    k.ticket = k.clients > 0 ? k.fat / k.clients : 0;
    out[source] = k;
  }
  return out;
}
let checks = 0;
for (const { i, result } of results) {
  const expected = reference(cases[i]);
  for (const source of ['current','history']) for (const key of Object.keys(expected[source])) {
    const a = expected[source][key], b = result.kpis[source][key];
    assert.ok(Math.abs(a - b) <= Math.max(1e-8, Math.abs(a) * 1e-10), `Caso ${i} ${source}.${key}: legado=${a}, RPC=${b}`);
    checks++;
  }
}
console.log(`${results.length} cenários reais, ${checks} valores: paridade OK`);

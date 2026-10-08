const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { webcrypto } = require('node:crypto');
const refs = require('../js/import-references.js');
const source = fs.readFileSync(path.join(__dirname, '../js/worker.js'), 'utf8');
const file = rows => ({ name: 'fixture.csv', rows });
const sale = { CODCLI: '1', PEDIDO: '101', CODUSUR: '7', NOME: 'Vendedor atual',
  SUPERV: 'Supervisor atual', CODSUPERVISOR: '3', DTPED: '2026-10-05', DTSAIDA: '2026-10-05',
  PRODUTO: '10', DESCRICAO: 'Sabão', FORNECEDOR: 'Empresa', OBSERVACAOFOR: 'MULTIMARCAS',
  CODFOR: '20', QTVENDA: 12, VLVENDA: 100, VLBONIFIC: 1, TOTPESOLIQ: 1, POSICAO: 'F',
  ESTOQUEUNIT: 10, TIPOVENDA: 1, FILIAL: '08', ESTOQUECX: 2 };
const context = {
  clients: [{ codigo_cliente: '1', rca1: '7', rcas: ['7'], nomecliente: 'Loja',
    razaosocial: 'Loja Ltda', cidade: 'Cidade', bairro: 'Centro', cnpj_cpf: '00123456789012' }],
  sales: [Object.fromEntries(Object.entries(sale).map(([k,v]) => [k.toLowerCase(), v]))],
  products: [{ code: '10', descricao: 'Produto', fornecedor: 'Fornecedor', codfor: '20', qtde_master: 6 }],
  activeProducts: [{ code: '10' }], vendedores: [{ codigo: '7', nome: 'Vendedor atual' }],
  supervisores: [{ codigo: '3', nome: 'Supervisor atual' }],
  fornecedores: [{ codigo: '20', nome: 'Fornecedor' }], produtos: [{ codigo: '10', descricao: 'Produto' }]
};
async function process(files, db = context) {
  const messages = [];
  const scope = vm.createContext({ console, crypto: webcrypto, TextEncoder, TextDecoder, Uint8Array,
    FileReader: class { readAsArrayBuffer(f) { this.onload({ target: { result: new TextEncoder().encode(JSON.stringify(f.rows)).buffer } }); } },
    Papa: { parse(text, opts) { opts.complete({ data: JSON.parse(text) }); } },
    self: { importScripts() {}, postMessage(m) { messages.push(m); } }
  });
  vm.runInContext(source, scope);
  await scope.self.onmessage({ data: { ...files, databaseReferences: db, importTables: refs.plan(files).tables } });
  const error = messages.find(m => m.type === 'error');
  if (error) throw new Error(error.message);
  return messages.find(m => m.type === 'result').data;
}
async function main() {
  const history = await process({ historyFile: file([{ ...sale, CODUSUR: '2', NOME: 'Antigo', FILIAL: '05', DTPED: '2026-07-05', DTSAIDA: '2026-07-05' }]) });
  assert.equal(history.history.values.CODUSUR[0], '7', 'history uses stored client RCA');
  assert.equal(history.history.values.NOME[0], 'Vendedor atual', 'history uses stored current sales and dimensions');
  assert.equal(history.history.values.FILIAL[0], '08', 'stored current sales supply branch context');
  assert.equal(history.history.values.QTVENDA_EMBALAGEM_MASTER[0], 2, 'stored master pack is used');
  assert.ok(!history.importTables.includes('data_clients'));
  assert.ok(!history.importTables.includes('data_detailed'));
  assert.ok(!history.metadata.some(m => ['hash_clients', 'hash_detailed', 'hash_orders', 'hash_stock', 'last_sale_date', 'passed_working_days'].includes(m.key)));
  const notes = await process({ notaInvolvesFile1: file([{ CNPJ: '123456789012', 'Nota Média': 9, Pesquisador: '7', 'Mês': '10/2026' }]) });
  assert.equal(notes.nota_perfeita[0].codigo_cliente, '1');
  const notes2 = await process({ notaInvolvesFile2: file([{ CNPJ: '00123456789012', 'Nota Média': 90, Pesquisador: '7' }]) });
  assert.equal(notes2.nota_perfeita[0].codigo_cliente, '1');
  const products = await process({ productsFile: file([{ 'Código': '10', 'Descrição': 'Produto novo', 'Nome do fornecedor': 'Fornecedor', Fornecedor: '20', 'Dt.Cadastro': '2026-01-01', 'Qtde embalagem master(Compra)': 12 }]) });
  assert.equal(products.product_details[0].qtde_master, 12);
  const historyProduct = await process({ productsFile: file([{ 'Código': '11', 'Descrição': 'Produto histórico', 'Nome do fornecedor': 'Empresa', Fornecedor: '20', 'Dt.Cadastro': '2026-01-01' }]) }, { ...context, soldProducts: [{ code: '11' }] });
  assert.ok(historyProduct.active_products.some(p => p.code === '11'), 'products sold only in stored history remain eligible');
  assert.ok(!products.importTables.includes('data_stock'));
  for (const [key, rows, table] of [
    ['hierarchyFile', [{ 'COD COORD.': '1', COORDENADOR: 'Coord', 'COD CO-COORD.': '2', 'CO-COORDENADOR': 'Co', 'COD PROMOTOR': '7', PROMOTOR: 'Promotor' }], 'data_hierarchy'],
    ['titulosFile', [{ CODCLI: 1, VLRECEBER: 10, DTVENC: '2026-10-10', VLTITULOS: 10, QTTITRECEBER: 1, QTTITULOS: 1 }], 'data_titulos'],
    ['innovationsFile', [{ PRODUTO: '10' }], 'data_innovations'],
    ['metasPesquisasFile', [{ promotor_code: '7', mes: 10, ano: 2026, valor_meta: 5 }], 'data_metas_pesquisas'],
    ['metasLojaPerfeitaFile', [{ promotor_code: '7', mes: 10, ano: 2026, valor_meta: 5 }], 'data_metas_loja_perfeita']
  ]) {
    const data = await process({ [key]: file(rows) }, {});
    assert.deepEqual(Array.from(data.importTables), [table]);
    assert.deepEqual(refs.plan({ [key]: file(rows) }).sources, []);
  }
  const sales = await process({ salesFile: file([sale]) });
  assert.equal(sales.byOrder[0].CLIENTE_NOME, 'Loja');
  assert.equal(sales.byOrder[0].CIDADE, 'Cidade');
  const both = await process({ salesFile: file([sale]), clientsFile: file([{ 'Código': '1', 'RCA 1': '7', Fantasia: 'Nova loja', Cidade: 'Nova cidade' }]) }, {});
  assert.equal(both.byOrder[0].CLIENTE_NOME, 'Nova loja', 'file takes precedence over database');
  await assert.rejects(process({ metasPesquisasFile: file([]) }, {}), /vazio/);
  await assert.rejects(process({ notaInvolvesFile1: file([{ Coluna: 'inválida' }]) }), /CNPJ/);
  const calls = [];
  const client = { async rpc(name, args) {
    assert.equal(name, 'get_import_reference_page_v1'); calls.push(args);
    if (args.p_source === 'clients') return { data: args.p_after ? { rows: [{ codigo_cliente: 'last' }], next: 'end' } : { rows: Array.from({ length: 2000 }, (_, i) => ({ codigo_cliente: String(i) })), next: 'cursor' } };
    return { data: { rows: [], next: null } };
  } };
  const loaded = await refs.load(client, { notaInvolvesFile1: {} });
  assert.equal(loaded.context.clients.length, 2001);
  assert.equal(calls[1].p_after, 'cursor');
  await assert.rejects(refs.load({ rpc: async () => ({ error: { message: 'offline' } }) }, { historyFile: {} }), /offline/);
  await assert.rejects(refs.load({ rpc: async () => ({ data: { rows: [], next: null } }) }, { notaInvolvesFile1: {} }), /cadastro de clientes/);
  // Exercise the actual uploader guard: read-only sources must never be cleared or written.
  const app = fs.readFileSync(path.join(__dirname, '../js/app/app.js'), 'utf8');
  const start = app.indexOf('                const conditionalUpload = async');
  const end = app.indexOf('                const forbiddenDimCols', start);
  const writes = [], clears = [];
  const scope = vm.createContext({ data: { importTables: ['data_history', 'dim_produtos'] },
    window: { supabaseClient: { from: () => ({ select: () => ({ limit: async () => ({ data: [{}] }) }) }) } },
    clearTable: async t => clears.push(t), uploadBatchParallel: async t => writes.push(t),
    checkHash: () => true, updateStatus() {}, console });
  await vm.runInContext(`(async () => { ${app.slice(start,end)}
    for (const t of ['data_detailed','data_orders','data_clients','data_stock','data_history','dim_produtos'])
      await conditionalUpload(t, [{ codigo: '1' }], 'hash', false);
  })()`, scope);
  assert.deepEqual(writes, ['data_history', 'dim_produtos']);
  assert.deepEqual(clears, ['data_history']);
  assert.ok(!app.includes("await clearTable('data_metadata', 'key')"));
  console.log('Standalone optional imports, RPC pagination/failures, file precedence and source preservation: OK');
}
main().catch(error => { console.error(error); process.exitCode = 1; });

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../js/init.js'), 'utf8');
const start = source.indexOf('const tablesToFetch = new Set();');
const end = source.indexOf('            if (useCache) {', start);
const planning = source.slice(start, end);
function plan(metadataRemote, cachedData) {
  const context = vm.createContext({metadataRemote, cachedData, isPromoter:false, useCache:false, console:{log(){}}});
  vm.runInContext(planning + '\nglobalThis.planResult={tables:[...tablesToFetch],staleWhileRevalidate,useCache};',context);
  return JSON.parse(JSON.stringify(context.planResult));
}
const wallets=['data_clients','data_hierarchy','data_client_promoters'];
test('missing and unchanged upload hashes cannot preserve stale wallet membership', () => {
  for (const hashes of [{}, {hash_clients:'same',hash_hierarchy:'same',hash_client_promoters:'same'}]) {
    const cache={clients:[{codigo_cliente:'old'}],hierarchy:[{}],clientPromoters:[{}],metadata:Object.entries(hashes).map(([key,value])=>({key,value}))};
    const result=plan(hashes,cache);
    for(const table of wallets) assert.ok(result.tables.includes(table));
    assert.equal(result.useCache,false);
    assert.equal(result.staleWhileRevalidate,false,'old wallet must not be displayed during refresh');
  }
});
test('metadata unavailable forces fresh data instead of silently trusting cache', () => {
  const result=plan(null,{clients:[{}],hierarchy:[{}],clientPromoters:[{}]});
  for(const table of wallets) assert.ok(result.tables.includes(table));
  assert.equal(result.useCache,false);
});
test('the three missing clients enter the WANDER filter after wallet refresh', () => {
  const app=fs.readFileSync(path.join(__dirname,'../js/app/app.js'),'utf8');
  const begin=app.indexOf('        function getHierarchyFilteredClients(');
  const finish=app.indexOf('        function updateFilterButtonText',begin);
  class ColumnarDataset {}
  const map=new Map();
  const clients=[{Código:'12404'},{Código:'12405'},{Código:'12406'}];
  const context=vm.createContext({ColumnarDataset,allClientsData:clients,normalizeKey:String,userHierarchyContext:{role:'adm'},hierarchyState:{main:{coords:new Set(),cocoords:new Set(['COORDENADOR 1','COORDENADOR 2']),promotors:new Set()}},optimizedData:{clientHierarchyMap:map}});
  vm.runInContext(app.slice(begin,finish),context);
  assert.equal(vm.runInContext("getHierarchyFilteredClients('main').length",context),0);
  for(const code of ['12404','12405','12406']) map.set(code,{coord:{code:'GERENTE MERCHAN'},cocoord:{code:'COORDENADOR 2'},promotor:{code:code==='12404'?'promotor3009':'promotor3010'}});
  assert.equal(vm.runInContext("getHierarchyFilteredClients('main').length",context),3);
});

const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const source = fs.readFileSync(require('node:path').join(__dirname, '../js/app/app.js'), 'utf8');
const section = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const encode_col = n => { let s = ''; for (n++; n; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + (n - 1) % 26) + s; return s; };
const warnings = [], files = []; let exported;
const ctx = { Set, Map, console, window: { showToast: (...args) => warnings.push(args), SUPPLIER_CODES: { ELMA: ['707','708','752'], VIRTUAL: { TODDYNHO:'1119_TODDYNHO', TODDY:'1119_TODDY', QUAKER_KEROCOCO:'1119_QUAKER_KEROCOCO' }, VIRTUAL_LIST:['1119_TODDYNHO','1119_TODDY','1119_QUAKER_KEROCOCO'] } },
  XLSX: { utils: { book_new: () => ({}), encode_col, aoa_to_sheet: data => { exported = data; return {}; }, json_to_sheet: data => { exported = data; return {}; }, book_append_sheet: () => {} }, writeFile: (_, name) => files.push(name) },
  getFirstName: v => v, quarterMonths: [{label:'JUL',key:'jul'}], currentGoalsSupplier:'708', currentGoalsBrand:null, goalsRenderId:2,
  goalsTableState: { exportContext:'707', exportRenderId:1, filteredData:[] }, goalsSellerTargets: new Map(), alert: message => warnings.push(message) };
vm.createContext(ctx);
vm.runInContext(section('        function exportToExcel(', '        // Invalidate export snapshots'), ctx);
vm.runInContext(section('        function cacheGoalsWorkbookFormulas(', '        window.isActiveClient'), ctx);
vm.runInContext(section('        function exportGoalsCurrentTabXLSX(', '        function getSellerTargetOverride'), ctx);
const metric = v => ({cod:'15',name:'Cliente',seller:'Vendedor',monthlyValues:{jul:v},avgFat:v,shareFat:.1,metaFat:v,avgVol:v,shareVol:.2,metaVol:v,mixPdv:3});
ctx.goalsTableState.filteredData = [metric(707)]; ctx.exportGoalsCurrentTabXLSX(); assert.equal(files.length,0);
for (const category of ['707','708','752','1119_TODDYNHO','1119_TODDY','1119_QUAKER_KEROCOCO','ELMA_ALL','FOODS_ALL','PEPSICO_ALL']) {
  const value = 1000 + files.length;
  ctx.currentGoalsSupplier = category; ctx.goalsTableState = {exportContext:category,exportRenderId:2,filteredData:[metric(value)]};
  ctx.exportGoalsCurrentTabXLSX(); assert.equal(exported[1][6],value); assert.equal(exported[1][9],value); assert(files.at(-1).includes(category));
}
const before = files.length; ctx.window.goalsUpdateTimeout = 1; ctx.exportGoalsCurrentTabXLSX(); assert.equal(files.length,before); ctx.window.goalsUpdateTimeout = null;
let pdfTable, pdfName;
ctx.document={getElementById:()=>({textContent:'Todos'})};ctx.hierarchyState={};ctx.selectedGoalsGvVendedores=new Set();
ctx.window.jspdf={jsPDF:class {setFontSize(){} setTextColor(){} text(){} autoTable(data){pdfTable=data;} save(name){pdfName=name;}}};
vm.runInContext(section('        function exportGoalsGvPDF(', '        function exportGoalsCurrentTabXLSX('),ctx);
ctx.currentGoalsSupplier='708';ctx.goalsTableState={exportContext:'707',exportRenderId:2,filteredData:[metric(707)]};ctx.exportGoalsGvPDF();assert.equal(pdfName,undefined);
for(const category of ['707','708','752','1119_TODDYNHO','1119_TODDY','1119_QUAKER_KEROCOCO','ELMA_ALL','FOODS_ALL','PEPSICO_ALL']) {
  ctx.currentGoalsSupplier=category;ctx.goalsTableState={exportContext:category,exportRenderId:2,filteredData:[metric(123.45)]};ctx.exportGoalsGvPDF();
  assert(pdfName.includes(category));assert.equal(pdfTable.body[0][6],'123,45');
}
const keys = ['total_elma','707','708','752','tonelada_elma','mix_salty','total_foods','1119_TODDYNHO','1119_TODDY','1119_QUAKER_KEROCOCO','tonelada_foods','mix_foods','geral','pedev'];
const data = Object.fromEntries(keys.map((key,i) => [key,{metaFat:100+i,metaVol:10+i,metaPos:20+i,avgFat:50+i,avgVol:5+i,avgMix:2+i,metaMix:3+i}]));
ctx.currentGoalsSvData = [{code:'1',name:'Supervisor',sellers:[{code:'2',name:'Vendedor',data}]}]; ctx.exportGoalsSvXLSX();
const headers = exported[0].map(cell => cell.v), seller = exported[3], supervisor = exported[4], grand = exported[5];
assert.equal(seller[headers.indexOf('EXTRUSADOS')].v,101); assert.equal(seller[headers.indexOf('NÃO EXTRUSADOS')].v,102);
for (const label of ['KG ELMA','KG FOODS','MIX SALTY','MIX FOODS']) {
  const c = headers.indexOf(label); assert.equal(supervisor[c].v,seller[c].v); assert.equal(grand[c].v,seller[c].v);
}
const c = headers.indexOf('EXTRUSADOS'); assert.equal(grand[c].v,101); assert.equal(grand[c+1].v,101);
ctx.exportToExcel({Mix:[{brands:new Set(['Doritos','Cheetos']),categoryOrders:new Map([['Doritos',2]]),variation:Infinity,meta:'private',value:25}]},'Mix');
assert.equal(exported[0].brands,'Doritos, Cheetos'); assert.equal(exported[0].categoryOrders,'{"Doritos":2}'); assert.equal(exported[0].variation,'Novo'); assert.equal(exported[0].value,25); assert(!('meta' in exported[0]));
ctx.allClientsData = [{'Código':'15'},{'Código':'273'}]; ctx.ColumnarDataset = class {};
ctx.optimizedData = {searchIndices:{clients:[{code:'15',nameLower:'mercado',razaoLower:'empresa comercio ltda',fantasiaLower:'loja azul',cnpj:'12345678000190'},{code:'273',nameLower:'outro'}]}};
vm.runInContext(section('        function searchLocalClients(', '        function setupClientTypeahead('),ctx);
for(const query of ['15','mercado','empresa comercio','loja azul','12.345.678/0001-90']) assert.equal(ctx.searchLocalClients(query,1)[0]['Código'],'15');
const handlers = {}; let updates=0;
ctx.goalsGvCodcliFilter={value:'15',addEventListener:(event,fn)=>handlers[event]=fn};ctx.selectedGoalsClientCode='';
ctx.setupClientTypeahead=(_,__,fn,min)=>{ctx.selectClient=fn;assert.equal(min,1);};ctx.normalizeKey=v=>String(v).trim();ctx.handleClientFilterCascade=()=>{};ctx.updateGoalsView=()=>updates++;
vm.runInContext(section("                setupClientTypeahead('goals-gv-codcli-filter'", '                // Make Goals Lupa Icon Interactive'),ctx);
handlers.input();assert.equal(updates,0);ctx.selectClient('15');assert.equal(updates,1);assert.equal(ctx.selectedGoalsClientCode,'15');
ctx.goalsGvCodcliFilter.value='outro';handlers.input();assert.equal(updates,1);assert.equal(ctx.selectedGoalsClientCode,'15');
ctx.goalsGvCodcliFilter.value='';handlers.input();assert.equal(updates,2);assert.equal(ctx.selectedGoalsClientCode,'');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');assert(html.includes('id="goals-gv-codcli-filter-suggestions"'));
const listeners={}, classes=new Set(['hidden']);let scheduled,chosen;
const input={value:'15',addEventListener:(event,fn)=>listeners[event]=fn,contains:target=>target===input};
const suggestions={children:[],classList:{add:v=>classes.add(v),remove:v=>classes.delete(v),contains:v=>classes.has(v)},appendChild:child=>suggestions.children.push(child),contains:()=>false,querySelector:()=>suggestions.children[0]};
ctx.document={getElementById:id=>id==='input'?input:suggestions,addEventListener:()=>{},createElement:()=>({focus:()=>{}})};
ctx.setTimeout=fn=>{scheduled=fn;return 1;};ctx.clearTimeout=()=>{scheduled=null;};ctx.window.escapeHtml=v=>String(v);
vm.runInContext(section('        function setupClientTypeahead(', '        function handleClientFilterCascade('),ctx);
ctx.setupClientTypeahead('input','suggestions',code=>chosen=code,1);
listeners.input({target:input});assert(scheduled);scheduled();assert(!classes.has('hidden'));assert.equal(chosen,undefined);
assert(suggestions.children[0].innerHTML.includes('15'));suggestions.children[0].onclick();assert.equal(chosen,'15');assert(classes.has('hidden'));
input.value='273';listeners.input({target:input});input.value='';listeners.input({target:input});assert.equal(scheduled,null);assert(classes.has('hidden'));
ctx.mixRenderId=1;ctx.mixTableDataForExport=[{value:707}];ctx.dashboardRpcState={coverage:{id:1}};ctx.coverageTableDataForExport=[{value:707}];
ctx.positivacaoRenderId=1;ctx.positivacaoDataForExport={active:[{}],inactive:[]};ctx.currentGoalsSvData=[{}];ctx.goalsSvRenderId=1;
vm.runInContext(section('        function invalidateFilteredExports(', '        function setupFab('),ctx);
for(const id of ['mix-city-filter','coverage-city-filter','positivacao-city-filter','goals-sv-supervisor-filter']) ctx.invalidateFilteredExports({target:{closest:()=>({id})}});
assert.equal(ctx.mixTableDataForExport.length,0);assert.equal(ctx.mixRenderId,2);assert.equal(ctx.coverageTableDataForExport.length,0);assert.equal(ctx.dashboardRpcState.coverage.id,2);
assert.equal(ctx.currentGoalsSvData.length,0);assert.equal(ctx.goalsSvRenderId,2);assert.equal(ctx.positivacaoDataForExport.active.length,0);
ctx.goalsTableState.exportContext='708';ctx.invalidateFilteredExports({target:{closest:()=>({id:'goals-gv-codcli-filter'})}});assert.equal(ctx.goalsTableState.exportContext,'708');
console.log('PASS: all goals categories, SV formulas/totals, scalar Excel values and client search/selection/clear');

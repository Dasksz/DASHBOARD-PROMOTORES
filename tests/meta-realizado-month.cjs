const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('js/app/app.js','utf8');
const section = (start,end) => source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
function harness() {
 const elements = new Map();
 const element = id => { if(!elements.has(id)) elements.set(id,{textContent:'',setAttribute(){},classList:{add(){},remove(){}}}); return elements.get(id); };
 const client = {'Código':'1',rca1:'10',nomeCliente:'Cliente'};
 const sale = (date,value,type='1') => ({DTPED:Date.parse(date),VLVENDA:value,TOTPESOLIQ:value/10,TIPOVENDA:type,CODCLI:'1',CODUSUR:'10',CODFOR:'707',OBSERVACAOFOR:'PEPSICO'});
 const current = [sale('2026-10-02',200)];
 const history = [sale('2026-09-02',100),sale('2026-08-02',900),sale('2026-09-03',5,'5')];
 const suppliers = {ELMA:['707','708','752'],FOODS:['1119'],VIRTUAL:{TODDYNHO:'1119_TODDYNHO',TODDY:'1119_TODDY',QUAKER_KEROCOCO:'1119_QUAKER_KEROCOCO'},VIRTUAL_LIST:['1119_TODDYNHO','1119_TODDY','1119_QUAKER_KEROCOCO'],ALL_GOALS:['707','708','752','1119_TODDYNHO','1119_TODDY','1119_QUAKER_KEROCOCO']};
 const requests = [];
 const ctx = {Date,Map,Set,console:{error(){}},ColumnarDataset:class {constructor(d){this.d=d;this.length=d.length;}get(i){return Object.fromEntries(this.d.columns.map(c=>[c,this.d.values[c][i]]));}},lastSaleDate:new Date('2026-10-02'),allSalesData:current,allHistoryData:history,allClientsData:[client],normalizeKey:String,normalize:s=>String(s).toUpperCase(),parseDate:d=>new Date(d),globalClientGoals:new Map([['1',new Map([['707',{fat:999,vol:99}]])]]),goalsSellerTargets:new Map(),selectedMetaRealizadoSuppliers:[],selectedMetaRealizadoSupervisors:new Set(),selectedMetaRealizadoVendedores:new Set(),currentMetaRealizadoPasta:'PEPSICO',currentMetaRealizadoMetric:'valor',adminViewMode:'promoter',hierarchyState:{'meta-realizado':{coords:new Set(),cocoords:new Set(),promotors:new Set(['P1'])}},sellerDetailsMap:new Map(),getHierarchyFilteredClients:()=>[client],isGarbageSeller:()=>false,clientMapForKPIs:new Map([['1',client]]),clientRamoMap:new Map(),lpResearcherMap:new Map(),userHierarchyContext:{role:'adm'},metaRealizadoClientsTableState:{currentPage:1,itemsPerPage:20},metaRealizadoDataForExport:{},markDirty(){},document:{getElementById:element},getFilteredDataFromIndices:(indices,byId,filters)=>(indices===ctx.optimizedData.indices.current?current:history).filter(s=>!filters.tipoVenda||filters.tipoVenda.has(s.TIPOVENDA)),renderMetaRealizadoTable(){},renderMetaRealizadoChart(){},renderMetaRealizadoPosChart(){},renderMetaRealizadoClientsTable(){}};
 ctx.optimizedData={indices:{current:{},history:{}},salesById:new Map(),historyById:new Map(),rcaNameByCode:new Map([['10','RCA10']]),clientsMap:new Map([['1',client]]),promotorMap:new Map([['P1','RCA10']])};
 ctx.window={ColumnarDataset:ctx.ColumnarDataset,SUPPLIER_CODES:suppliers,userRole:'adm',escapeHtml:String,normalizeResearcherCode:String,isActiveClient:()=>true,allClientsData:[client],resolveDim:()=> 'RCA10',embeddedData:{nota_perfeita:[{codigo_cliente:'1',mes_ano:'setembro de 2026',pesquisador:'P1',nota_media:90},{codigo_cliente:'1',mes_ano:'outubro de 2026',pesquisador:'P1',nota_media:20}],metas_pesquisas:[{mes:9,ano:2026,promotor_code:'P1',valor_meta:10},{mes:10,ano:2026,promotor_code:'P1',valor_meta:20}],metas_lojaperfeita:[]}};
 ctx.window.supabaseClient={from:()=>{let month; const q={select:()=>q,eq:(key,value)=>{if(key==='month_key')month=value;return q;},maybeSingle:async()=>{requests.push(month);if(ctx.fail) return {error:Error('offline')}; return {data:month==='2026-09'?{goals_data:{clients:{'1':{'707':{fat:500,vol:50}}},seller_targets:{}}}:null};}};return q;}};
 vm.createContext(ctx);
 vm.runInContext(section('        // Monthly context is private','        // End monthly context.')+section('        function getMetaRealizadoSupplierColumns','        function getMetaRealizadoGoalKeys')+section('        function getMonthWeeksDistribution','        function getMetaRealizadoFilteredData')+section('        function getMetaRealizadoFilteredData','        function renderMetaRealizadoTable')+section('        async function updateMetaRealizadoView','        function renderMetaRealizadoClientsTable')+section('        function calculateAdjustedWeeklyGoals','        // --- IMPORT PARSER AND LOGIC ---')+`\nthis.api={key:metaRealizadoMonthKey,select:m=>selectedMetaRealizadoMonth=m,source:getMetaRealizadoPeriodSource,goals:getMetaRealizadoGoalMaps,load:loadMetaRealizadoMonthGoals,filtered:getMetaRealizadoFilteredData,clients:getMetaRealizadoClientsData,update:updateMetaRealizadoView,export:()=>metaRealizadoDataForExport,currentMonths:metaRealizadoCurrentMonths,pendingGoals:p=>metaRealizadoGoalsReady=p,reloadGoals:fn=>metaRealizadoGoalsReload=fn};`,ctx);
 ctx.api.currentMonths.add('2026-10'); return {ctx,api:ctx.api,elements,requests};
}
test('month keys include year and parse survey dates without timezone shifts',()=>{const {api}=harness();assert.equal(api.key('setembro de 2026'),'2026-09');assert.equal(api.key('09/2026'),'2026-09');assert.equal(api.key('2026-10-02T00:00:00Z'),'2026-10');assert.equal(api.key('2026-13'),null);assert.equal(api.key(new Date('2025-12-31T23:59:59Z')),'2025-12');});
test('historical month uses its saved targets and history sales, retaining client and promoter scope',async()=>{const {api,ctx,requests}=harness();api.select('2026-09');await api.load('2026-09');const data=api.filtered();assert.equal(data.goalsBySeller.get('RCA10').totalFat,500);assert.equal(data.salesBySeller.get('RCA10').totalFat,100);assert.equal(data.salesBySeller.get('RCA10').perdas,5);assert.equal(api.clients(data.weeks)[0].realTotal,100);assert.equal(api.clients(data.weeks)[0].metaTotal,500);assert.equal(ctx.globalClientGoals.get('1').get('707').fat,999);assert.deepEqual(requests,['2026-09']);});
test('absent historical goals never reuse another month targets',async()=>{const {api}=harness();api.select('2026-08');await api.load('2026-08');assert.equal(api.goals().clients.size,0);assert.equal(api.filtered().salesBySeller.get('RCA10').totalFat,900);});
test('charts, client rows, losses, research KPIs, goals and exports use the same month',async()=>{const {api,elements}=harness();api.select('2026-09');await api.update();assert.equal(elements.get('kpi-metas-pesquisas-real').textContent,'1');assert.equal(elements.get('kpi-metas-pesquisas-meta').textContent,'10');assert.equal(elements.get('kpi-metas-lojaperfeita-real').textContent,'1');assert.equal(api.export().month,'2026-09');assert.equal(api.export().sellers[0].realTotal,100);assert.equal(api.export().clients[0].realTotal,100);assert.match(elements.get('meta-realizado-period-status').textContent,/Metas salvas/);});
test('load failure does not render or export stale data for the newly selected month',async()=>{const {api,ctx,elements}=harness();ctx.fail=true;api.select('2026-09');await api.update();assert.match(elements.get('meta-realizado-period-status').textContent,/Não foi possível/);assert.equal(api.export().sellers.length,0);});
test('a slow previous month response cannot replace the latest selected month',async()=>{const {api,ctx}=harness();let finishSeptember;ctx.window.supabaseClient={from:()=>{let month;const q={select:()=>q,eq:(key,value)=>{if(key==='month_key')month=value;return q;},maybeSingle:()=>month==='2026-09'?new Promise(resolve=>{finishSeptember=resolve;}):Promise.resolve({data:null})};return q;}};api.select('2026-09');const old=api.update();api.select('2026-08');await api.update();finishSeptember({data:{goals_data:{clients:{'1':{'707':{fat:500,vol:50}}}}}});await old;assert.equal(api.export().month,'2026-08');assert.equal(api.export().sellers[0].realTotal,900);});
test('all-promoter KPIs exclude seller routes even when they audit a promoter client',async()=>{const {api,ctx,elements}=harness();ctx.hierarchyState['meta-realizado'].promotors.clear();ctx.window.embeddedData.nota_perfeita.push({codigo_cliente:'2',mes_ano:'setembro de 2026',pesquisador:'ROTA2',nota_media:100});ctx.lpResearcherMap.set('ROTA2',{sellerCode:'10'});ctx.window.embeddedData.metas_pesquisas.push({mes:9,ano:2026,promotor_code:'ROTA2',cod_vendedor:'10',valor_meta:999});api.select('2026-09');await api.update();assert.equal(elements.get('kpi-metas-pesquisas-real').textContent,'1');assert.equal(elements.get('kpi-metas-lojaperfeita-real').textContent,'1');assert.equal(elements.get('kpi-metas-pesquisas-meta').textContent,'10');});
test('seller mode resolves route codes to the selected seller and excludes promoter targets',async()=>{const {api,ctx,elements}=harness();ctx.adminViewMode='seller';ctx.selectedMetaRealizadoVendedores.add('10');ctx.sellerDetailsMap.set('10',{name:'RCA10',supervisor:'S1'});ctx.lpResearcherMap.set('ROTA2',{sellerCode:'10'});ctx.window.embeddedData.nota_perfeita.push({codigo_cliente:'2',mes_ano:'setembro de 2026',pesquisador:'ROTA2',nota_media:90});ctx.window.embeddedData.metas_pesquisas.push({mes:9,ano:2026,promotor_code:'ROTA2',cod_vendedor:'10',valor_meta:20});api.select('2026-09');await api.update();assert.equal(elements.get('kpi-metas-pesquisas-real').textContent,'1');assert.equal(elements.get('kpi-metas-pesquisas-meta').textContent,'20');});
test('implicit promoter login scope applies even with no hierarchy filter selected',async()=>{const {api,ctx,elements}=harness();ctx.hierarchyState['meta-realizado'].promotors.clear();ctx.window.userRole='P1';ctx.userHierarchyContext={role:'promotor',promotor:'P1'};ctx.optimizedData.promotorMap.set('P2','Outro');ctx.window.embeddedData.nota_perfeita.push({codigo_cliente:'2',mes_ano:'setembro de 2026',pesquisador:'P2',nota_media:100});ctx.window.embeddedData.metas_pesquisas.push({mes:9,ano:2026,promotor_code:'P2',valor_meta:999});api.select('2026-09');await api.update();assert.equal(elements.get('kpi-metas-pesquisas-real').textContent,'1');assert.equal(elements.get('kpi-metas-pesquisas-meta').textContent,'10');});
test('distinct stores and monthly average scores remain the KPI units, not audit row counts',async()=>{const {api,ctx,elements}=harness();ctx.window.embeddedData.nota_perfeita.push({codigo_cliente:'2',cnpj_cpf:'12345678000100',mes_ano:'setembro de 2026',pesquisador:'P1',nota_media:70},{codigo_cliente:'3',cnpj_cpf:'12.345.678/0001-00',mes_ano:'setembro de 2026',pesquisador:'P1',nota_media:90});api.select('2026-09');await api.update();assert.equal(elements.get('kpi-metas-pesquisas-real').textContent,'2');assert.equal(elements.get('kpi-metas-lojaperfeita-real').textContent,'2');});

test('no-sales toggle respects scoped portfolio, includes clients without targets and classifies revenue independently of weight',async()=>{
 const {api,ctx}=harness(); api.select('2026-09'); await api.load('2026-09');
 const second={'Código':'2',rca1:'10',nomeCliente:'Sem meta'};
 ctx.allClientsData.push(second);
 ctx.getHierarchyFilteredClients=()=>ctx.allClientsData;
 const weeks=api.filtered().weeks;
 ctx.metaRealizadoClientsTableState.onlyWithoutSales=true;
 assert.deepEqual(Array.from(api.clients(weeks),r=>r.codcli),['2']);
 ctx.currentMetaRealizadoMetric='peso';ctx.allHistoryData[0].TOTPESOLIQ=0;
 assert.deepEqual(Array.from(api.clients(weeks),r=>r.codcli),['2']);
 ctx.getHierarchyFilteredClients=()=>[ctx.allClientsData[0]];
 assert.equal(api.clients(weeks).length,0);
 ctx.getHierarchyFilteredClients=()=>[second];
 assert.deepEqual(Array.from(api.clients(weeks),r=>r.codcli),['2']);
 ctx.metaRealizadoClientsTableState.onlyWithoutSales=false;
 assert.equal(api.clients(weeks).length,0);
});

test('inline no-sales button handler is exposed outside the app closure and toggles back',()=>{
 const start=source.indexOf('        window.toggleMetaRealizadoClientsWithoutSales = function()');
 assert.ok(start>=0);
 const handler=source.slice(start,source.indexOf('        async function updateMetaRealizadoView()',start));
 const context={window:{},state:{currentPage:4,onlyWithoutSales:false},updates:0};
 vm.createContext(context);
 vm.runInContext('(function(){const metaRealizadoClientsTableState=state;function updateMetaRealizadoView(){updates++;}'+handler+'})();',context);
 assert.equal(typeof context.window.toggleMetaRealizadoClientsWithoutSales,'function');
 context.window.toggleMetaRealizadoClientsWithoutSales();
 assert.equal(context.state.onlyWithoutSales,true);assert.equal(context.state.currentPage,1);
 context.window.toggleMetaRealizadoClientsWithoutSales();
 assert.equal(context.state.onlyWithoutSales,false);assert.equal(context.updates,2);
});
test('gap ranking uses absolute shortfall, excludes unpositivated clients and restores normal order',async()=>{
 const {ctx,api}=harness();api.select('2026-09');await api.load('2026-09');
 const goals=api.goals().clients;
 for(const [code,target,revenue] of [['2',1000,900],['3',2000,0],['4',100,150],['5',900,200]]){
  ctx.allClientsData.push({'Código':code,rca1:'10',nomeCliente:code});goals.set(code,new Map([['707',{fat:target,vol:target}]]));
  ctx.allHistoryData.push({DTPED:Date.parse('2026-09-02'),VLVENDA:revenue,TOTPESOLIQ:revenue,TIPOVENDA:'1',CODCLI:code,CODUSUR:'10',CODFOR:'707',OBSERVACAOFOR:'PEPSICO'});
 }
 ctx.getHierarchyFilteredClients=()=>ctx.allClientsData;
 const weeks=api.filtered().weeks;ctx.metaRealizadoClientsTableState.largestGapFirst=true;
 assert.deepEqual(Array.from(api.clients(weeks),r=>r.codcli),['5','1','2','4']);
 ctx.metaRealizadoClientsTableState.largestGapFirst=false;
 assert.deepEqual(Array.from(api.clients(weeks),r=>r.codcli),['3','2','5','1','4']);
});
test('client supplier targets use saved month, correct brand codes, Salty subtotal and selected metric/filter',async()=>{
 const {api,ctx}=harness();api.select('2026-09');await api.load('2026-09');
 const keys=['707','708','752','1119_TODDYNHO','1119_TODDY','1119_QUAKER_KEROCOCO'];
 api.goals().clients.set('1',new Map(keys.map((key,i)=>[key,{fat:(i+1)*10,vol:(i+1)*100}])));
 const weeks=api.filtered().weeks;
 let row=api.clients(weeks)[0];
 assert.deepEqual({...row.supplierGoals},{salty:60,extrusados:10,naoExtrusados:20,quakerKerococo:60,toddy:50,toddynho:40,torcida:30});assert.equal(row.metaTotal,210);
 ctx.currentMetaRealizadoMetric='peso';row=api.clients(weeks)[0];assert.equal(row.supplierGoals.salty,600);assert.equal(row.supplierGoals.quakerKerococo,600);assert.equal(row.metaTotal,2100);
 ctx.selectedMetaRealizadoSuppliers=['707'];row=api.clients(weeks)[0];assert.equal(row.supplierGoals.salty,100);assert.equal(row.supplierGoals.extrusados,100);assert.equal(row.supplierGoals.torcida,0);assert.equal(row.metaTotal,100);
 ctx.selectedMetaRealizadoSuppliers=[];ctx.currentMetaRealizadoPasta='FOODS';row=api.clients(weeks)[0];assert.equal(row.supplierGoals.salty,0);assert.equal(row.metaTotal,1500);
});
test('supplier realized values split Foods brands, total Salty, exclude bonuses/cancelled sales and use selected month/metric',async()=>{
 const {api,ctx}=harness();api.select('2026-09');await api.load('2026-09');
 for(const [code,description,value] of [['708','NAO EXTRUSADOS',20],['752','TORCIDA',30],['1119','QUAKER KEROCOCO',40],['1119','TODDY',50],['1119','TODDYNHO',60]])ctx.allHistoryData.push({DTPED:Date.parse('2026-09-04'),CODCLI:'1',CODUSUR:'10',CODFOR:code,DESCRICAO:description,OBSERVACAOFOR:'PEPSICO',TIPOVENDA:'1',VLVENDA:value,TOTPESOLIQ:value/10});
 ctx.allHistoryData.push({DTPED:Date.parse('2026-09-04'),CODCLI:'1',CODFOR:'708',OBSERVACAOFOR:'PEPSICO',TIPOVENDA:'5',VLVENDA:999},{DTPED:Date.parse('2026-09-04'),CODCLI:'1',CODFOR:'752',OBSERVACAOFOR:'PEPSICO',TIPOVENDA:'11',VLVENDA:999});
 const weeks=api.filtered().weeks;let row=api.clients(weeks)[0];assert.deepEqual({...row.supplierSales},{salty:150,extrusados:100,naoExtrusados:20,quakerKerococo:40,toddy:50,toddynho:60,torcida:30});assert.equal(row.realTotal,300);
 ctx.currentMetaRealizadoMetric='peso';row=api.clients(weeks)[0];assert.equal(row.supplierSales.salty,15);assert.equal(row.supplierSales.toddynho,6);assert.equal(row.realTotal,30);
 ctx.selectedMetaRealizadoSuppliers=['1119_TODDY'];row=api.clients(weeks)[0];assert.equal(row.realTotal,5);assert.equal(row.supplierSales.toddy,5);assert.equal(row.supplierSales.toddynho,0);assert.equal(row.supplierSales.salty,0);
});
test('Americanas split preserves supplier realized values in the filtered portfolio',async()=>{const {api,ctx}=harness();api.select('2026-09');await api.load('2026-09');for(const code of ['541','544','546'])ctx.allClientsData.push({'Código':code,rca1:'10',nomeCliente:'AMERICANAS'});ctx.getHierarchyFilteredClients=()=>ctx.allClientsData;ctx.allHistoryData.push({DTPED:Date.parse('2026-09-05'),CODCLI:'3297',CODFOR:'707',OBSERVACAOFOR:'PEPSICO',TIPOVENDA:'1',VLVENDA:90,TOTPESOLIQ:9});const weeks=api.filtered().weeks;const rows=api.clients(weeks).filter(r=>['541','544','546'].includes(r.codcli));assert.equal(rows.length,3);for(const row of rows){assert.equal(row.supplierSales.salty,30);assert.equal(row.supplierSales.extrusados,30);assert.equal(row.realTotal,30)}});
test('Salty gaps override general gaps even when Foods reverses the ranking',async()=>{const {api,ctx}=harness();api.select('2026-09');await api.load('2026-09');api.goals().clients.set('1',new Map([['707',{fat:200,vol:200}],['1119_TODDY',{fat:10000,vol:10000}]]));ctx.allClientsData.push({'Código':'2',rca1:'10',nomeCliente:'Outro'},{'Código':'3',rca1:'10',nomeCliente:'Sem venda'});api.goals().clients.set('2',new Map([['707',{fat:1000,vol:1000}]]));api.goals().clients.set('3',new Map([['707',{fat:20000,vol:20000}]]));ctx.getHierarchyFilteredClients=()=>ctx.allClientsData;ctx.allHistoryData.push({DTPED:Date.parse('2026-09-04'),CODCLI:'1',CODFOR:'1119',DESCRICAO:'TODDY',OBSERVACAOFOR:'PEPSICO',TIPOVENDA:'1',VLVENDA:5000,TOTPESOLIQ:5000},{DTPED:Date.parse('2026-09-04'),CODCLI:'2',CODFOR:'707',OBSERVACAOFOR:'PEPSICO',TIPOVENDA:'1',VLVENDA:100,TOTPESOLIQ:100});ctx.metaRealizadoClientsTableState.largestGapFirst=true;const rows=api.clients(api.filtered().weeks);assert.deepEqual(Array.from(rows,r=>r.codcli),['2','1']);assert.equal(ctx.getMetaRealizadoSaltyGap(rows[0]),900);assert.equal(ctx.getMetaRealizadoSaltyGap(rows[1]),100);assert.ok(rows[0].metaTotal-rows[0].realTotal<rows[1].metaTotal-rows[1].realTotal)});

test('current-month panel waits for saved goals before counting rows or enabling exports',async()=>{
 const {api,ctx}=harness();api.select('2026-10');let finish;
 api.pendingGoals(new Promise(resolve=>{finish=resolve}));let rendered=0;ctx.renderMetaRealizadoClientsTable=()=>rendered++;
 const loading=api.update();await Promise.resolve();assert.equal(rendered,0);assert.equal(api.export().clients.length,0);
 ctx.globalClientGoals.set('1',new Map([['707',{fat:500,vol:50}]]));finish();await loading;
 assert.equal(rendered,1);assert.equal(api.export().clients[0].metaTotal,500);await api.update();assert.equal(api.export().clients[0].metaTotal,500);
});
test('failed saved-goal load cannot silently show provisional targets and supports retry',async()=>{
 const {api,ctx,elements}=harness();api.select('2026-10');const failed=Promise.reject(Error('offline'));failed.catch(()=>{});api.pendingGoals(failed);
 api.reloadGoals(async()=>{throw Error('offline')});await api.update();assert.equal(api.export().clients.length,0);assert.match(elements.get('meta-realizado-period-status').textContent,/Não foi possível/);
 api.reloadGoals(async()=>{ctx.globalClientGoals.set('1',new Map([['707',{fat:700,vol:70}]]))});await api.update();assert.equal(api.export().clients[0].metaTotal,700);
});
test('switching months during initial goal load cannot publish the old month count',async()=>{
 const {api}=harness();api.select('2026-10');let finish;api.pendingGoals(new Promise(resolve=>{finish=resolve}));const old=api.update();api.select('2026-09');await api.update();finish();await old;assert.equal(api.export().month,'2026-09');assert.equal(api.export().clients[0].metaTotal,500);
});

function itaoHarness(codes=['546']) {
 const h=harness(),{ctx,api}=h;
 api.select('2026-10');ctx.allSalesData.length=0;
 const clients=codes.map(code=>({'Código':code,rca1:'53',nomeCliente:'ITAO '+code}));
 ctx.allClientsData=clients;ctx.getHierarchyFilteredClients=()=>clients;
 ctx.optimizedData.rcaNameByCode.set('53','BALCAO');
 const rows=[{CODCLI:'3297',CODFOR:'707',CODUSUR:'78',DTPED:Date.parse('2026-10-26'),VLVENDA:320.04,TOTPESOLIQ:30,TIPOVENDA:'1'},{CODCLI:'3297',CODFOR:'708',CODUSUR:'78',DTPED:Date.parse('2026-10-26'),VLVENDA:1120.82,TOTPESOLIQ:60,TIPOVENDA:'1'},{CODCLI:'3297',CODFOR:'1119',CODUSUR:'78',DTPED:Date.parse('2026-10-26'),VLVENDA:4033.05,TOTPESOLIQ:90,TIPOVENDA:'1'}];
 const columns=Object.keys(rows[0]);
 const utils=fs.readFileSync('js/app/utils.js','utf8');
 vm.runInContext(utils.slice(utils.indexOf('window.allocateItaoDataset = function')),ctx);
 const clientColumns=['CODIGO_CLIENTE','NOMECLIENTE'];
 const allocated=ctx.window.allocateItaoDataset({columns,values:Object.fromEntries(columns.map(k=>[k,rows.map(s=>s[k])])),length:rows.length},{columns:clientColumns,values:{CODIGO_CLIENTE:codes,NOMECLIENTE:codes.map(c=>'ITAO '+c)},length:codes.length});
 const dimensionRows=Array.from({length:allocated.length},(_,i)=>({...Object.fromEntries(columns.map(k=>[k,allocated.values[k][i]])),OBSERVACAOFOR:'PEPSICO'}));
 ctx.allSalesData.push(...dimensionRows);
 return {...h,rows};
}
test('Itao source reaches both tables as one third per visible store without changing ordinary sales',()=>{
 for(const codes of [['546'],['541','544'],['541','544','546']]) {
  const {api,ctx}=itaoHarness(codes),result=api.filtered(),clients=api.clients(result.weeks);
  assert.equal(clients.length,codes.length);
  for(const row of clients) assert.ok(Math.abs(row.realTotal-5473.91/3)<1e-8);
  assert.ok(Math.abs(result.salesBySeller.get('BALCAO').totalFat-5473.91*codes.length/3)<1e-8);
  assert.equal(ctx.allSalesData.length,3*codes.length);
  ctx.metaRealizadoClientsTableState.onlyWithoutSales=true;
  assert.equal(api.clients(result.weeks).length,0);
 }
});
test('Itao allocation retains supplier, metric and month filters, and does not duplicate admin source',()=>{
 const {api,ctx,rows}=itaoHarness();
 ctx.selectedMetaRealizadoSuppliers.push('707');
 let result=api.filtered();assert.ok(Math.abs(api.clients(result.weeks)[0].realTotal-320.04/3)<1e-8);
 ctx.currentMetaRealizadoMetric='peso';assert.equal(api.clients(result.weeks)[0].realTotal,10);
 ctx.currentMetaRealizadoMetric='valor';ctx.selectedMetaRealizadoSuppliers.length=0;
 // Admin dataset is already allocated; re-running must be idempotent.
 result=api.filtered();assert.ok(Math.abs(result.salesBySeller.get('BALCAO').totalFat-5473.91/3)<1e-8);
 api.select('2026-09');result=api.filtered();assert.equal(result.salesBySeller.has('BALCAO'),false);
});
test('Itao source never creates sales for a portfolio without an allocation recipient',()=>{
 const {api}=itaoHarness(['999']);const result=api.filtered();assert.equal(result.salesBySeller.size,0);assert.equal(api.clients(result.weeks).length,0);
});
test('targeted loading adds only the allocation source and leaves client portfolio query unchanged',()=>{
 const init=fs.readFileSync('js/init.js','utf8');
 const start=init.indexOf('                const applyClientFilter = (q) => {');
 const end=init.indexOf('                // Helper to decide source',start);
 const code=init.slice(start,end)+';this.apply=applyClientFilter;this.clients=applyClientTableFilter;';
 for(const wallet of [[],['546'],['541','544','546'],['999'],['3297','546']]) {
  const context={isAdm:false,scopedClientCodes:new Set(wallet),scopedSellerCodes:null};vm.createContext(context);vm.runInContext(code,context);
  const query={in:(key,values)=>({key,values}),eq:(key,value)=>({key,value})};
  const sales=context.apply(query),clients=context.clients(query);
  if(wallet.length) {assert.deepEqual(Array.from(clients.values),wallet);assert.equal(sales.values.filter(c=>c==='3297').length,wallet.some(c=>['3297','541','544','546'].includes(c))?1:0);}
  else assert.equal(sales.key,'id');
 }
});

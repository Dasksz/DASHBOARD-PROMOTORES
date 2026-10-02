const fs=require('node:fs'), vm=require('node:vm'), assert=require('node:assert/strict'), path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../js/app/app.js'),'utf8');
const events=new Map(), nodes=new Map(), requests=[],timers=new Map(),charts=[];let timerID=0;
function node(id='') {
 const classes=new Set(); const n={id,innerHTML:'conteúdo anterior',textContent:'',style:{},value:'',dataset:{},listeners:{},
 classList:{add(...v){v.forEach(x=>classes.add(x));},remove(...v){v.forEach(x=>classes.delete(x));},contains:v=>classes.has(v),toggle(v,on){if(on===undefined) on=!classes.has(v);on?classes.add(v):classes.delete(v);}},
 setAttribute(k,v){this[k]=v;},addEventListener(k,fn){(this.listeners[k]||=[]).push(fn);},querySelector(sel){if(sel==='.dashboard-rpc-status')return this.status||null;if(sel==='button')return this.button||(this.button=node());if(sel==='tbody')return this.tbody||(this.tbody=node());return null;},querySelectorAll(){return [];},contains(){return true;},closest(){return this;},prepend(v){this.status=v;},remove(){for(const parent of nodes.values())if(parent.status===this)parent.status=null;},insertAdjacentHTML(_,s){this.innerHTML+=s;}};return n;
}
const el=id=>{if(!nodes.has(id))nodes.set(id,node(id));return nodes.get(id);};
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const ctx={console:{error(){}},Set,Array,Date,Number,JSON,Error,AbortController,
 setTimeout(fn,delay){const id=++timerID;timers.set(id,{fn,delay});return id;},clearTimeout:id=>timers.delete(id),
 document:{getElementById:el,createElement:()=>node(),addEventListener(k,fn){events.set(k,fn);},getElementsByName:()=>[]},
 window:{innerWidth:1024,escapeHtml:escape,userRole:'adm',supabaseClient:{rpc(name,args){const req={name,args};requests.push(req);return{abortSignal(signal){req.signal=signal;return new Promise(resolve=>req.resolve=resolve);}};}}},
 hierarchyState:{},adminViewMode:'promoter',selectedCoverageSupervisors:new Set(),selectedCoverageVendedores:new Set(),selectedCoverageSuppliers:[],selectedCoverageProducts:[],selectedCoverageTiposVenda:[],selectedCoverageRedes:[],coverageRedeGroupFilter:'',coverageTrendFilter:'all',customWorkingDaysCoverage:0,currentCoverageMetricMode:'boxes',currentCoverageChartMode:'city',
 selectedCoverageDateRange:{start:null,end:null},selectedCoveragePriceMin:null,selectedCoveragePriceMax:null,
 selectedWeeklySupervisors:new Set(),selectedWeeklyVendedores:new Set(),selectedWeeklySuppliers:new Set(),selectedWeeklyRedes:[],weeklyRedeGroupFilter:'',weeklyFilialFilter:'all',selectedWeeklyMonth:'current',
 coverageCityFilter:el('coverage-city-filter'),coverageCitySuggestions:el('coverage-city-suggestions'),coverageFilialFilter:el('coverage-filial-filter'),clearCoverageFiltersBtn:el('clear-coverage-filters-btn'),
 coverageTableBody:el('coverage-table-body'),coverageTableDataForExport:[],getFirstName:n=>n.split(' ')[0],createChart:(...args)=>charts.push(args),showNoDataMessage:(...args)=>charts.push(args),renderWeeklyChart:(...args)=>charts.push(args),resetCoverageFilters(){}
};
ctx.coverageFilialFilter.value='ambas';
for(const [global,id] of Object.entries({coverageActiveClientsKpi:'coverage-active-clients-kpi',coverageTopCoverageValueKpi:'coverage-top-coverage-value-kpi',coverageTopCoverageProductKpi:'coverage-top-coverage-product-kpi',coverageTopCoverageCountKpi:'coverage-top-coverage-count-kpi',coverageSelectionCoverageValueKpi:'coverage-selection-coverage-value-kpi',coverageSelectionCoverageCountKpi:'coverage-selection-coverage-count-kpi',coverageSelectionCoverageValueKpiPrevious:'coverage-selection-coverage-value-kpi-previous',coverageSelectionCoverageCountKpiPrevious:'coverage-selection-coverage-count-kpi-previous',coverageTotalBoxesEl:'coverage-total-boxes'}))ctx[global]=el(id);
vm.createContext(ctx);
const start=source.indexOf('        // RPC pages:');const end=source.indexOf('        function updateAllCoverageFilters()',start);
vm.runInContext(source.slice(start,end),ctx);
const cov=source.indexOf('        function updateCoverageView()');const covEnd=source.indexOf('        // <!-- FIM DO CÓDIGO RESTAURADO -->',cov);
vm.runInContext(source.slice(cov,covEnd),ctx);
const resetStart=source.indexOf('        function resetCoverageFilters() {');vm.runInContext(source.slice(resetStart,cov),ctx);
const wk=source.indexOf('    function updateWeeklyView()');const wkEnd=source.indexOf('    let weeklyChartInstance',wk);vm.runInContext(source.slice(wk,wkEnd),ctx);
// Regression: setupEventListeners must bind the legacy price input to the RPC path.
const bindingStart=source.indexOf('            const updateCoverage = () => {');
assert.ok(bindingStart>=0,'callback de preço presente');
const bindingEnd=source.indexOf("            document.addEventListener('click'",bindingStart);
let dirtyCalls=0,filterCalls=0,blurCalls=0;
ctx.markDirty=view=>{assert.equal(view,'cobertura');dirtyCalls++;};
ctx.handleCoverageFilterChange=()=>filterCalls++;
vm.runInContext(source.slice(bindingStart,bindingEnd),ctx);
const price=el('coverage-unit-price-filter');
assert.equal(price.listeners.blur.length,1,'registro de blur não lança ReferenceError');
price.listeners.blur[0]();
price.listeners.keydown[0]({key:'Enter',target:{blur(){blurCalls++;}}});
assert.equal(dirtyCalls,2);assert.equal(filterCalls,2);assert.equal(blurCalls,1);
const launch=()=>{const [id,t]=[...timers].find(([,t])=>t.delay===150)||[];assert.ok(t);timers.delete(id);return t.fn();};
const facet={schema_version:1,reference_date:"2026-10-02",suppliers:[{code:'707',label:'PEPSICO'}],products:[],types:[],sellers:[],supervisors:[],coords:[],cocoords:[],promotors:[],redes:[],months:['2026-10','2026-09'],cities:['Ilhéus']};
const coverage=n=>({schema_version:1,active_clients:2,active_3m:2,current_clients:1,previous_clients:1,total_boxes:n,chart_total:n,top:null,rows:[],cities:[{name:'Ilhéus',value:n}],ranking:[{name:'PROM TESTE',value:n}]});
const weekly=n=>({schema_version:1,weeks:[{id:1,start:'2026-10-01',end:'2026-10-04',total:n,days:[0,0,0,0,n,0,0]}],best_days:[0,1,2,3,4,5,0],ranking_fat:[{code:'1',name:'JOÃO TESTE',val:n,pos:2}],ranking_pos:[{code:'1',name:'JOÃO TESTE',val:n,pos:2}]});
function resolveBatch(from,data){for(const req of requests.slice(from))req.resolve({error:null,data:req.name==='get_dashboard_filters_v1'?facet:data});}
(async()=>{
 ctx.updateCoverageView();ctx.updateCoverageView();assert.equal([...timers.values()].filter(t=>t.delay===150).length,1);
 assert.equal(ctx.coverageTableBody.innerHTML,'conteúdo anterior','layout preservado durante carga');
 const first=launch();assert.equal(requests.length,2);ctx.updateCoverageView();assert.ok(requests.every(r=>r.signal.aborted));
 const second=launch();resolveBatch(0,coverage(1));await first;await second;assert.equal(charts.length,2,'resposta velha descartada');assert.equal(el('coverage-view')['aria-busy'],'false');
 const from=requests.length;ctx.updateCoverageView();const cached=launch();assert.equal(requests.length-from,1,'opções em cache, sem vendas locais');resolveBatch(from,coverage(2));await cached;
 assert.match(el('coverage-chart-total-kpi').textContent,/2/);assert.equal(ctx.coverageTableDataForExport.length,0,'exportação vazia atualizada');
 ctx.updateWeeklyView();const wi=requests.length,work=launch();resolveBatch(wi,weekly(9));await work;assert.match(el('weekly-summary-table').tbody.innerHTML,/9,00/);assert.match(el('weekly-ranking-fat').innerHTML,/JOÃO/);
 assert.doesNotMatch(el('weekly-month-filter-dropdown').innerHTML,/value="2026-10"/,'mês atual sem duplicação');
 assert.match(el('weekly-month-filter-dropdown').innerHTML,/value="2026-09"/,'mês anterior preservado');
 assert.match(el('weekly-month-filter-dropdown').innerHTML,/value="current"/);
 ctx.setupRpcPageFilters('weekly');ctx.setupRpcPageFilters('weekly');const fd=el('weekly-filial-filter-dropdown');assert.equal(fd.listeners.change.length,1,'handlers únicos');
 fd.listeners.change[0]({target:{type:'radio',value:'08',closest:()=>({querySelector:()=>({textContent:'Filial 08'})})}});
 const bi=requests.length,branch=launch();assert.equal(requests[bi].args.p_filters.filial,'08','filial enviada corretamente à RPC');resolveBatch(bi,weekly(8));await branch;
 // Numbers render before options finish; facet errors do not discard valid page data.
 ctx.selectedCoverageSuppliers=['707'];
 const slowFrom=requests.length;ctx.updateCoverageView();const slow=launch();
 requests[slowFrom].resolve({error:null,data:coverage(77)});
 for(let i=0;i<10;i++) await Promise.resolve();
 assert.match(el('coverage-chart-total-kpi').textContent,/77/,'dados visíveis sem aguardar opções');
 assert.equal(el('coverage-view')['aria-busy'],'false');
 requests[slowFrom+1].resolve({error:{message:'facet timeout'},data:null});await slow;
 assert.ok(!el('coverage-view').status,'falha das opções não oculta dados válidos');
 ctx.selectedCoverageSuppliers=[];
 const fi=requests.length;ctx.updateCoverageView();const bad=launch();requests[fi].resolve({data:null,error:{message:'timeout'}});await bad;assert.ok(el('coverage-view').status);assert.match(el('coverage-view').status.innerHTML,/Tentar novamente/);
 el('coverage-view').status.querySelector('button').listeners.click[0]();const retryFrom=requests.length,retry=launch();resolveBatch(retryFrom,coverage(3));await retry;assert.equal(el('coverage-view').status,null);
 // Click the actual Clear handler while a filtered request is still pending.
 ctx.setupRpcPageFilters('coverage');
 ctx.hierarchyState.coverage.promotors.add('promotor7');ctx.selectedCoverageSuppliers=['707'];
 ctx.selectedCoverageProducts=['1'];ctx.selectedCoverageTiposVenda=['5'];
 ctx.coverageTrendFilter='low';ctx.customWorkingDaysCoverage=20;ctx.selectedCoveragePriceMin=2;
 ctx.coverageCityFilter.value='Jequié';ctx.coverageFilialFilter.value='08';
 const oldFrom=requests.length;ctx.updateCoverageView();const oldRequest=launch();
 ctx.clearCoverageFiltersBtn.listeners.click[0]();
 assert.ok(requests[oldFrom].signal.aborted,'limpar cancela consulta filtrada');
 const clearFrom=requests.length,clearedRequest=launch();
 const resetFilters=requests[clearFrom].args.p_filters;
 for(const key of ['coords','cocoords','promotors','suppliers','products','types','supervisors','sellers','redes']) assert.equal(resetFilters[key].length,0,key+' limpo na RPC');
 assert.equal(resetFilters.city,'');assert.equal(resetFilters.filial,'ambas');assert.equal(resetFilters.trend,'all');assert.equal(resetFilters.price_min,null);assert.equal(resetFilters.working_days,0);
 resolveBatch(clearFrom,coverage(88));await clearedRequest;
 for(const req of requests.slice(oldFrom,clearFrom))req.resolve({error:null,data:req.name==='get_dashboard_filters_v1'?facet:coverage(4)});
 await oldRequest;assert.match(el('coverage-chart-total-kpi').textContent,/88/,'resposta antiga não reaplica o filtro');
 const row={code:'1',descricao:'(1) <img src=x onerror=alert(1)>',stockQty:1,boxesSoldCurrentMonth:1,boxesSoldPreviousMonth:0,boxesVariation:null,pdvVariation:null,trendDays:null,clientsPreviousCount:0,clientsCurrentCount:1,coverageCurrent:50};
 const data=coverage(102);data.rows=Array.from({length:102},(_,i)=>({...row,code:String(i)}));ctx.validateDashboardPayload('coverage',data);ctx.renderCoverageRpc(data,ctx.dashboardPageFilters('coverage'));
 assert.equal(ctx.coverageTableDataForExport.length,102,'exportação inclui todos os resultados');assert.equal(ctx.coverageTableDataForExport[0].boxesVariation,Infinity,'marcador Novo');assert.match(ctx.coverageTableBody.innerHTML,/&lt;img/);assert.doesNotMatch(ctx.coverageTableBody.innerHTML,/<img src=x/);assert.equal((ctx.coverageTableBody.innerHTML.match(/Exibindo os primeiros/g)||[]).length,1,'sem rodapé duplicado');
 const broken=weekly(1);broken.best_days=[NaN];assert.throws(()=>ctx.validateDashboardPayload('weekly',broken),/Histórico/);
 assert.equal(timers.size,0);console.log('Cobertura/Semanal: RPC completa, debounce, cancelamento, cache, filial, erro/retry, gráficos, exportação completa e escape HTML: OK');
})().catch(e=>{console.error(e);process.exitCode=1;});

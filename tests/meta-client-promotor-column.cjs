const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/app/app.js','utf8');
const start=source.indexOf('        function renderMetaRealizadoClientsTable(data, weeks)');
const end=source.indexOf('\n        function ',start+30);
function harness(){
 const elements=new Map();const get=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',classList:{add(){},remove(){}},addEventListener(type,handler){this[type]=handler}});return elements.get(id)};
 const ctx={document:{getElementById:get},hierarchyState:{'meta-realizado':{promotors:new Set(),coords:new Set(['C1'])}},optimizedData:{clientHierarchyMap:new Map([['1',{promotor:{name:'ERICARLOS & CIA'}}]])},getMetaRealizadoSupplierColumns:()=>Array.from({length:7},(_,i)=>({id:String(i),label:String(i)})),normalizeKey:String,escapeHtml:s=>String(s).replaceAll('&','&amp;'),getFirstName:String,formatMetaRealizadoValue:String,getAchievementColorClass:()=>'',metaRealizadoClientsTableState:{currentPage:1,itemsPerPage:50,totalPages:1,filteredData:[{codcli:'1',vendedor:'VENDEDOR',cidade:'CIDADE',razaoSocial:'CLIENTE',metaTotal:10,realTotal:0,weekData:[]}]}};
 vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);return {ctx,get,render:()=>ctx.renderMetaRealizadoClientsTable([],[])};
}
test('coordinator scope shows responsible promoter directly after seller, including mobile',()=>{const {render,get}=harness();render();const head=get('meta-realizado-clients-table-head').innerHTML;assert.match(head,/VENDEDOR<\/th>\s*<th[^>]*>PROMOTOR<\/th>\s*<th[^>]*>CIDADE/);assert.match(get('meta-realizado-clients-table-body').innerHTML,/ERICARLOS &amp; CIA/)});
test('any promoter selection hides column; clearing restores it',()=>{const {ctx,render,get}=harness();ctx.hierarchyState['meta-realizado'].promotors.add('P1');render();assert.doesNotMatch(get('meta-realizado-clients-table-head').innerHTML,/PROMOTOR/);assert.doesNotMatch(get('meta-realizado-clients-table-body').innerHTML,/ERICARLOS/);ctx.hierarchyState['meta-realizado'].promotors.clear();render();assert.match(get('meta-realizado-clients-table-head').innerHTML,/PROMOTOR/)});
test('unassigned clients have explicit fallback and empty column spans track visibility',()=>{const {ctx,render,get}=harness();ctx.optimizedData.clientHierarchyMap.clear();render();assert.match(get('meta-realizado-clients-table-body').innerHTML,/Não informado/);ctx.metaRealizadoClientsTableState.filteredData=[];render();assert.match(get('meta-realizado-clients-table-body').innerHTML,/colspan="23"/);ctx.hierarchyState['meta-realizado'].promotors.add('P1');render();assert.match(get('meta-realizado-clients-table-body').innerHTML,/colspan="22"/)});
test('only global top ten shortfalls are red, including across pagination',()=>{const {ctx,render,get}=harness();const row=ctx.metaRealizadoClientsTableState.filteredData[0];ctx.metaRealizadoClientsTableState.filteredData=Array.from({length:14},(_,i)=>({...row,codcli:String(i+1)}));ctx.metaRealizadoClientsTableState.largestGapFirst=true;render();assert.equal((get('meta-realizado-clients-table-body').innerHTML.match(/background-color:rgba/g)||[]).length,10);ctx.metaRealizadoClientsTableState.itemsPerPage=7;ctx.metaRealizadoClientsTableState.currentPage=2;render();assert.equal((get('meta-realizado-clients-table-body').innerHTML.match(/background-color:rgba/g)||[]).length,3);ctx.metaRealizadoClientsTableState.largestGapFirst=false;render();assert.doesNotMatch(get('meta-realizado-clients-table-body').innerHTML,/background-color:rgba/)});

test('gap highlight overrides even-row striping with close red tones',()=>{const {ctx,render,get}=harness();const row=ctx.metaRealizadoClientsTableState.filteredData[0];ctx.metaRealizadoClientsTableState.filteredData=[row,{...row,codcli:'2'}];ctx.metaRealizadoClientsTableState.largestGapFirst=true;render();const body=get('meta-realizado-clients-table-body').innerHTML;assert.match(body,/background-color:rgba\(127,29,29,0.28\) !important/);assert.match(body,/background-color:rgba\(127,29,29,0.26\) !important/)});

test('client table has seven supplier targets and no weekly headers',()=>{const {ctx,render,get}=harness();ctx.getMetaRealizadoSupplierColumns=()=>['Salty','Extrusados','Não extrusados','Quaker / Kerococo','Toddy','Toddynho','Torcida'].map((label,i)=>({label,id:String(i)}));ctx.metaRealizadoClientsTableState.filteredData[0].supplierGoals={'0':123};render();const head=get('meta-realizado-clients-table-head').innerHTML;assert.doesNotMatch(head,/SEMANA/);for(const name of ['Salty','Extrusados','Não extrusados','Quaker / Kerococo','Toddy','Toddynho','Torcida'])assert.ok(head.includes(name));assert.match(get('meta-realizado-clients-table-body').innerHTML,/>123<\/td>/)});
test('supplier columns each render Meta and Realizado values side by side',()=>{const {ctx,render,get}=harness();const row=ctx.metaRealizadoClientsTableState.filteredData[0];row.supplierGoals={'0':123};row.supplierSales={'0':456};render();const head=get('meta-realizado-clients-table-head').innerHTML;assert.equal((head.match(/colspan="2"/g)||[]).length,8);assert.equal((head.match(/>META<\/th>/g)||[]).length,8);assert.equal((head.match(/>REALIZADO<\/th>/g)||[]).length,8);assert.match(get('meta-realizado-clients-table-body').innerHTML,/>123<\/td><td[^>]*>456<\/td>/)});

test('actual Next/Previous clicks navigate loaded pages without recomputing the dashboard',()=>{
 for(const mode of ['normal','onlyWithoutSales','largestGapFirst']){
  const {ctx,render,get}=harness();const row=ctx.metaRealizadoClientsTableState.filteredData[0];
  const rows=Array.from({length:101},(_,i)=>({...row,codcli:String(i+1)}));
  ctx.metaRealizadoClientsTableState.filteredData=rows;ctx.metaRealizadoClientsTableState.totalPages=3;
  if(mode!=='normal')ctx.metaRealizadoClientsTableState[mode]=true;
  ctx.getMetaRealizadoExportSnapshot=()=>({weeks:[]});
  ctx.updateMetaRealizadoView=()=>assert.fail('paging must not recalculate or reload data');
  const a=source.indexOf('        function changeMetaRealizadoClientPage('),b=source.indexOf('        window.toggleMetaRealizadoClientsWithoutSales',a);
  vm.runInContext(source.slice(a,b),ctx);render();
  const next=get('meta-realizado-clients-next-page-btn'),prev=get('meta-realizado-clients-prev-page-btn'),event={preventDefault(){}};
  next.click(event);assert.equal(ctx.metaRealizadoClientsTableState.currentPage,2);assert.match(get('meta-realizado-clients-page-info-text').textContent,/Página 2 de 3/);assert.match(get('meta-realizado-clients-table-body').innerHTML,/>51<\/td>/);
  next.click(event);assert.equal(ctx.metaRealizadoClientsTableState.currentPage,3);assert.equal(next.disabled,true);assert.match(get('meta-realizado-clients-table-body').innerHTML,/>101<\/td>/);
  next.click(event);assert.equal(ctx.metaRealizadoClientsTableState.currentPage,3);
  prev.click(event);prev.click(event);assert.equal(ctx.metaRealizadoClientsTableState.currentPage,1);assert.equal(prev.disabled,true);assert.equal(ctx.metaRealizadoClientsTableState.filteredData,rows);
  ctx.getMetaRealizadoExportSnapshot=()=>null;next.click(event);assert.equal(ctx.metaRealizadoClientsTableState.currentPage,1);
 }
});

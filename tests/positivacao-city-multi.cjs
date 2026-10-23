const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const source = fs.readFileSync(path.join(__dirname,'../js/app/app.js'),'utf8');
const section = (a,b) => source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
const list={innerHTML:''}, label={}, query={value:''};
const ctx={console,Map,Set,Date, adminViewMode:'seller',window:{userRole:'adm',escapeHtml:s=>String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')},
 selectedPositivacaoCities:new Set(),positivacaoCityOptionsKey:'', selectedPositivacaoVendedores:new Set(['1']), selectedPositivacaoSupervisors:new Set(),
 selectedPositivacaoRedes:[],selectedPositivacaoSuppliers:[],positivacaoRedeGroupFilter:'',positivacaoCodCliFilter:{value:''},positivacaoCityFilter:query,
 document:{getElementById:id=>id==='positivacao-city-suggestions'?list:id==='positivacao-city-filter-text'?label:null},
 ColumnarDataset:class {},sellerDetailsMap:new Map([['1',{supervisor:'S1'}],['2',{supervisor:'S2'}]]),optimizedData:{indices:{current:[]},salesById:{}},
 getFilteredDataFromIndices:(_,__,filters)=>[{CODCLI:'a',VLVENDA:100},{CODCLI:'b',VLVENDA:200},{CODCLI:'c',VLVENDA:300}].filter(s=>filters.clientCodes.has(s.CODCLI)),
 allClientsData:[
  {'Código':'a',rca1:'1',cidade:'Ilhéus'}, {'Código':'b',rca1:'1',cidade:'ITABUNA'},
  {'Código':'c',rca1:'1',cidade:'Itabuninha'}, {'Código':'d',rca1:'1',cidade:' ilhéus '},
  {'Código':'other',rca1:'2',cidade:'SALVADOR'}, {'Código':'shared',rca1:'2',cidade:'ITABUNA'},
  {'Código':'orphan',rca1:'',cidade:'FORA'}, {'Código':'unknown',rca1:'1',cidade:'N/A'}]
};
vm.createContext(ctx);
vm.runInContext(section('        function positivacaoCityKey(', '        function updateAllPositivacaoFilters('),ctx);
const codes=rows=>Array.from(rows,r=>r['Código']);
ctx.updatePositivacaoCityFilter();
assert(list.innerHTML.includes('Ilhéus'));assert(list.innerHTML.includes('ITABUNA'));assert(!list.innerHTML.includes('SALVADOR'));assert(!list.innerHTML.includes('FORA'));
assert.equal((list.innerHTML.match(/value="ILHÉUS"/g)||[]).length,1);
ctx.selectedPositivacaoCities=new Set(['ILHÉUS','ITABUNA']);ctx.updatePositivacaoCityFilter();
assert.deepEqual(codes(ctx.getPositivacaoFilteredData().clients),['a','b','d']);
assert.deepEqual(Array.from(ctx.getPositivacaoFilteredData().sales,s=>s.CODCLI),['a','b']);
assert(label.textContent.includes('Ilhéus')&&label.textContent.includes('ITABUNA'));
// City options exclude their own selection, so other cities remain selectable.
assert(list.innerHTML.includes('Itabuninha'));
query.value='itab';ctx.updatePositivacaoCityFilter();assert(!list.innerHTML.includes('<span>Ilhéus</span>'));assert.equal(ctx.getPositivacaoFilteredData().clients.length,3);
// Switching seller keeps only shared valid selections; search text cannot hide the new portfolio.
ctx.selectedPositivacaoVendedores=new Set(['2']);ctx.updatePositivacaoCityFilter();
assert.deepEqual(Array.from(ctx.selectedPositivacaoCities),['ITABUNA']);assert(!list.innerHTML.includes('ILHÉUS'));assert(list.innerHTML.includes('SALVADOR'));assert.equal(query.value,'');
ctx.selectedPositivacaoCities.clear();assert.deepEqual(codes(ctx.getPositivacaoFilteredData().clients),['other','shared']);
ctx.selectedPositivacaoSupervisors=new Set(['S1']);ctx.updatePositivacaoCityFilter();assert.equal(ctx.selectedPositivacaoCities.size,0);assert(!list.innerHTML.includes('checkbox'));
// Multiple sellers use the union of their portfolios, with exact city matching.
ctx.selectedPositivacaoSupervisors.clear();ctx.selectedPositivacaoVendedores=new Set(['1','2']);ctx.updatePositivacaoCityFilter();
ctx.selectedPositivacaoCities=new Set(['ITABUNA']);assert.deepEqual(codes(ctx.getPositivacaoFilteredData().clients),['b','shared']);
// Hierarchy mode preserves its existing access-scoped client source.
ctx.adminViewMode='promotor';ctx.getHierarchyFilteredClients=()=>[ctx.allClientsData[0]];ctx.updatePositivacaoCityFilter();assert.deepEqual(codes(ctx.getPositivacaoFilteredData().clients),['a']);assert(!list.innerHTML.includes('SALVADOR'));
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');assert(html.includes('aria-controls="positivacao-city-dropdown"'));
console.log('PASS: seller-scoped city options, multi-selection, exact matching, cascade pruning, search, sales and hierarchy scope');
// Real view classification and PDF export use the same multi-city subset.
ctx.adminViewMode='seller';ctx.selectedPositivacaoVendedores=new Set(['1','2']);ctx.selectedPositivacaoCities=new Set(['ITABUNA','ILHÉUS']);
ctx.positivacaoRenderId=0;ctx.positivacaoDataForExport={};ctx.positivacaoActiveState={limit:50};ctx.positivacaoInactiveState={limit:50};
ctx.positivacaoActiveDetailTableBody=null;ctx.positivacaoInactiveDetailTableBody=null;ctx.lastSaleDate=new Date('2026-10-23');
ctx.parseDate=()=>null;ctx.renderPositivacaoActiveTable=()=>{};ctx.renderPositivacaoInactiveTable=()=>{};ctx.runAsyncChunked=(rows,each,done)=>{rows.forEach(each);done();};
vm.runInContext(section('        function getPositivacaoLastPurchaseFilters()', '        function renderPositivacaoActiveTable()'),ctx);
ctx.updatePositivacaoView();assert.deepEqual(codes(ctx.positivacaoDataForExport.active),['b','a']);assert.deepEqual(codes(ctx.positivacaoDataForExport.inactive),['d','shared']);
const texts=[];let pdfRows;
ctx.window.jspdf={jsPDF:class{internal={getNumberOfPages:()=>1,pageSize:{width:210,height:297}};setFontSize(){}setTextColor(){}text(v){texts.push(v);}splitTextToSize(v){return[v];}autoTable(o){pdfRows=o.body;}setPage(){}save(){}}};
ctx.hierarchyState={};ctx.formatDate=()=> 'N/A';
vm.runInContext(section('        function exportClientsPDF(', '        function renderCalendar('),ctx);
ctx.exportClientsPDF(ctx.positivacaoDataForExport.inactive,'Inativos','inativos',false,{filterPrefix:'positivacao',preserveOrder:true});
assert.deepEqual(Array.from(pdfRows.slice(0,-1),row=>row[0]),['d','shared']);assert(texts.flat().includes('Cidade: ITABUNA, ILHÉUS'));
console.log('PASS: multi-city active/inactive lists and inactive PDF rows/header match');

const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/app/app.js','utf8');
const section=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
function harness(showPromotor=true,largestGapFirst=true){
 const tables=[],written=[];const row={codcli:'1',razaoSocial:'Cliente',vendedor:'Vendedor',promotor:'ERICARLOS',cidade:'Cidade',perdas:0,metaTotal:200,realTotal:100,weekData:[{meta:200,real:100}]};
 const snapshot={month:'2026-10',sellers:[],clients:Array.from({length:12},(_,i)=>({...row,codcli:String(i+1)})),weeks:[{}],showPromotor,largestGapFirst};
 class PDF{constructor(){this.internal={getNumberOfPages:()=>2,pageSize:{width:297,height:210}};}setFontSize(){}text(){}setTextColor(){}addPage(){}setPage(){}save(){}autoTable(options){tables.push(options);}}
 const utils={book_new:()=>({Sheets:{}}),json_to_sheet:rows=>{const ws={'!ref':'A1:K13'};Object.keys(rows[0]).forEach((k,c)=>{ws[`${c},0`]={v:k};rows.forEach((r,i)=>ws[`${c},${i+1}`]={v:r[k]})});return ws;},book_append_sheet:(wb,ws,name)=>wb.Sheets[name]=ws,decode_range:()=>({s:{c:0},e:{c:10}}),encode_cell:({r,c})=>`${c},${r}`};
 const ctx={selectedMetaRealizadoMonth:snapshot.month,metaRealizadoClientsTableState:{filteredData:snapshot.clients,onlyWithoutSales:false,largestGapFirst},window:{SUPPLIER_CODES:{ELMA:['707','708','752'],VIRTUAL:{TODDYNHO:'1119_TODDYNHO',TODDY:'1119_TODDY',QUAKER_KEROCOCO:'1119_QUAKER_KEROCOCO'}},jspdf:{jsPDF:PDF},showToast(){}},document:{getElementById:()=>({textContent:'Todos'})},metaRealizadoDataForExport:snapshot,hierarchyState:{'meta-realizado':{promotors:new Set()}},selectedMetaRealizadoVendedores:new Set(),currentMetaRealizadoPasta:'PEPSICO',formatMetaRealizadoValue:String,getFirstName:String,XLSX:{utils,writeFile:wb=>written.push(wb)},alert:()=>assert.fail('unexpected alert')};vm.createContext(ctx);
 vm.runInContext(section('        function getMetaRealizadoSupplierColumns','        function getMetaRealizadoGoalKeys')+section('        function exportToExcel(', '        // Invalidate export snapshots')+section('        function getMetaRealizadoExportSnapshot(', '            function renderAiFullPage'),ctx);
 return {ctx,snapshot,tables,written};
}
test('PDF exports conditional promoter column and highlights exactly top ten across document rows',async()=>{for(const show of [true,false]){const {ctx,tables}=harness(show);await ctx.exportMetaRealizadoPDF();const t=tables[tables.length-1];assert.equal(t.head[0].some(h=>h.content==='Promotor'),show);assert.equal(t.body[0].includes('ERICARLOS'),show);for(let i=0;i<12;i++){const cell={section:'body',row:{index:i},cell:{styles:{}}};t.didParseCell(cell);assert.equal(!!cell.cell.styles.fillColor,i<10)}}});
test('Excel uses matching ordered scalar rows, conditional column and red fills only on top ten',()=>{for(const show of [true,false]){const {ctx,snapshot,written}=harness(show);const rows=ctx.getMetaRealizadoClientExportRows(snapshot);assert.equal(Object.keys(rows[0]).includes('Promotor'),show);assert.equal(rows.length,12);assert.equal(rows[11]['Cód'],'12');assert.ok(Object.values(rows[0]).every(v=>typeof v!=='object'));ctx.exportToExcel({Clientes:rows},'test',{Clientes:ctx.getMetaRealizadoHighlightedClientRows(snapshot)});const sheet=written[0].Sheets.Clientes;assert.equal(sheet['0,1'].s.fill.fgColor.rgb,'F5CDD1');assert.equal(sheet['0,2'].s.fill.fgColor.rgb,'F8D7DA');assert.ok(sheet['0,10'].s);assert.equal(sheet['0,11'].s,undefined)}});
test('normal mode has no gap highlights and reached targets are not painted',()=>{const {ctx,snapshot}=harness(true,false);assert.equal(ctx.getMetaRealizadoHighlightedClientRows(snapshot).length,0);snapshot.largestGapFirst=true;snapshot.clients[0].realTotal=300;assert.ok(!ctx.getMetaRealizadoHighlightedClientRows(snapshot).includes(0));assert.ok(!ctx.getMetaRealizadoHighlightedClientRows(snapshot).includes(10))});

test('no-sales PDF and Excel contain only matching clients and omit unfiltered sellers',async()=>{
 const {ctx,snapshot,tables,written}=harness(true,false);
 snapshot.onlyWithoutSales=true;ctx.metaRealizadoClientsTableState.onlyWithoutSales=true;
 snapshot.sellers=[{name:'GERAL SEM FILTRO',weekData:[],metaTotal:999,realTotal:888}];
 snapshot.clients[0].realTotal=0;snapshot.clients[0].revenueTotal=0;
 snapshot.clients[1].realTotal=0;snapshot.clients[1].revenueTotal=100;
 await ctx.exportMetaRealizadoPDF();
 assert.equal(tables.length,1);assert.equal(tables[0].body.length,1);assert.equal(tables[0].body[0][0],'1');
 ctx.exportMetaRealizadoExcel();
 assert.deepEqual(Object.keys(written[0].Sheets),['Clientes']);
 assert.equal(written[0].Sheets.Clientes['1,1'].v,'1');
 assert.equal(written[0].Sheets.Clientes['1,2'],undefined);
});
test('gap PDF and Excel exclude zero-revenue clients, share gap order and omit sellers',async()=>{
 const {ctx,snapshot,tables,written}=harness(true,true);
 snapshot.sellers=[{name:'GERAL SEM FILTRO',weekData:[],metaTotal:999,realTotal:888}];
 snapshot.clients[0].realTotal=0;snapshot.clients[0].revenueTotal=0;
 snapshot.clients[1].metaTotal=900;
 await ctx.exportMetaRealizadoPDF();ctx.exportMetaRealizadoExcel();
 assert.equal(tables.length,1);assert.equal(tables[0].body.length,11);
 assert.equal(tables[0].body[0][0],'2');assert.ok(!tables[0].body.some(r=>r[0]==='1'));
 assert.deepEqual(Object.keys(written[0].Sheets),['Clientes']);assert.equal(written[0].Sheets.Clientes['1,1'].v,'2');
 let highlights=0;tables[0].body.forEach((_,index)=>{const cell={section:'body',row:{index},cell:{styles:{}}};tables[0].didParseCell(cell);if(cell.cell.styles.fillColor)highlights++;});
 assert.equal(highlights,10);
});
test('pending snapshot, changed month and changed client mode block both exports',async()=>{
 for(const change of [
  ctx=>ctx.metaRealizadoClientsTableState.onlyWithoutSales=true,
  ctx=>ctx.metaRealizadoClientsTableState.largestGapFirst=false,
  ctx=>ctx.selectedMetaRealizadoMonth='2026-09',
  ctx=>ctx.metaRealizadoClientsTableState.filteredData=[]
 ]){
  const {ctx,tables,written}=harness();change(ctx);
  await ctx.exportMetaRealizadoPDF();ctx.exportMetaRealizadoExcel();
  assert.equal(tables.length,0);assert.equal(written.length,0);
 }
});

test('PDF and Excel client detail replace all weekly cells with seven supplier targets',async()=>{const {ctx,snapshot,tables}=harness(true,false);snapshot.clients[0].supplierGoals={salty:60,extrusados:10,naoExtrusados:20,quakerKerococo:60,toddy:50,toddynho:40,torcida:30};const rows=ctx.getMetaRealizadoClientExportRows(snapshot);assert.equal(rows[0]['Meta Salty'],60);assert.equal(rows[0]['Meta Quaker / Kerococo'],60);assert.equal(rows[0]['Meta Torcida'],30);assert.ok(!Object.keys(rows[0]).some(k=>k.includes('Semana')));await ctx.exportMetaRealizadoPDF();const clients=tables[tables.length-1];assert.deepEqual(Array.from(clients.head[0].slice(-7),c=>c.content),['Salty','Extrusados','Não extrusados','Quaker / Kerococo','Toddy','Toddynho','Torcida']);assert.deepEqual(Array.from(clients.body[0].slice(-7)),['60','10','20','60','50','40','30']);assert.ok(!clients.head[0].some(c=>String(c.content).includes('Semana')))});

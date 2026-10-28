const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../js/worker.js'),'utf8');
function section(a,b){const i=source.indexOf(a);return source.slice(i,source.indexOf(b,i));}
const initial=section('                const productMasterMap = new Map();','                const clientRcaOverrides = new Map();');
const enrich=section('                // Update productMasterMap / productDetailsMap','                self.postMessage({ type: \'progress\', status: \'Aplicando regra de filial...\'');
const exportCode=section('                const finalProductDetailsData =','                const finalStockData =');
const dims=section('                const finalDimProdutos =','                // --- HASH COMPUTATION');
function process(rows){const ctx={Map,Set,Number,String,Error,Date,console,productsFile:{name:'cadastro.xls'},productsDataRaw:rows,soldProductCodes:new Set(['1']),fallbackData:null,normalizeKey:String,parseDate:()=>null,self:{postMessage(){}},stockLinesCollector:[{PRODUTO:'2',DESCRICAO:'Somente estoque'}],processedSalesData:[{PRODUTO:'3',VLVENDA:20,DESCRICAO:'Somente venda'}]};vm.createContext(ctx);vm.runInContext(section('function normalizeClientIdentifier(','function normalizeClientRows(')+initial+enrich+exportCode+dims+'globalThis.result={details:finalProductDetailsData,active:finalActiveProductsData,dims:finalDimProdutos};',ctx);return JSON.parse(JSON.stringify(ctx.result));}
const rows=[{'Código':'1','Descrição':'Produto vendido'},{'Código':'4','Descrição':'Produto sem venda'}];
const result=process(rows);assert.deepEqual(result.details.map(p=>p.code),['1','4']);assert.deepEqual(result.active.map(p=>p.code),['1','4']);assert.deepEqual(result.dims.map(p=>p.codigo),['1','4']);
assert.throws(()=>process([]),/vazia/);assert.throws(()=>process([...rows,rows[0]]),/duplicado/);assert.throws(()=>process([{'Código':'1'}]),/descrição/);
const app=fs.readFileSync(path.join(__dirname,'../js/app/app.js'),'utf8');
assert.ok(!app.includes("conditionalUpload('dim_produtos'"));assert.ok(!app.includes("conditionalUpload('data_product_details'"));
const uploadStart=app.indexOf('                // Do not rebuild the catalog'),uploadEnd=app.indexOf("                await conditionalUpload('data_hierarchy'",uploadStart);
const uploadCode=app.slice(uploadStart,uploadEnd);
(async()=>{
 for(const hasFile of [false,true]){
  const calls=[],ids=[];let attempt=0;
  await vm.runInNewContext('(async()=>{'+uploadCode+'})()',{document:{getElementById:()=>({files:hasFile?[{}]:[]})},crypto:{randomUUID:()=> 'once'},data:{product_details:[{code:'1'}],metadata:[{key:'hash_product_details',value:'hash'}]},formatValue:(_,v)=>v,updateStatus(){},committedMetadataKeys:new Set(),retryOperation:async fn=>{try{return await fn();}catch(e){return fn();}},window:{PrimeImportIntegrity:{rowsForUpload:(_,rows)=>rows},supabaseClient:{rpc:async(name,args)=>{calls.push(name);ids.push(args.p_import_id);return ++attempt===1?{error:Error('timeout')}:{error:null};}}}});
  assert.equal(calls.length,hasFile?2:0);if(hasFile)assert.deepEqual(ids,['once','once']);
 }
 console.log('Product uploader passed: omitted files never replace catalogs; retries reuse the same operation.');
})().catch(e=>{console.error(e);process.exitCode=1;});
console.log('Product catalog passed: all master products retained, unsold products included, stock/sales-only items excluded, empty/duplicate/incomplete files rejected.');

const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../js/app/app.js'),'utf8');
const start=source.indexOf('                const conditionalUpload = async'),end=source.indexOf('                const forbiddenDimCols',start);
async function run(table,match=false){
 const calls=[],importIds=[];let tries=0;
 const context={console,crypto:{randomUUID:()=> 'import-once'},data:{metadata:[{key:'hash_clients',value:'hash'}]},committedMetadataKeys:new Set(),
  checkHash:()=>!match,updateStatus(){},clearTable:async table=>calls.push('clear:'+table),uploadBatchParallel:async table=>calls.push('upload:'+table),formatValue:(_,v)=>v,
  retryOperation:async fn=>{try{return await fn();}catch(e){return fn();}},
  window:{PrimeImportIntegrity:{rowsForUpload:()=>[{codigo_cliente:'1'}]},supabaseClient:{from:()=>({select(){return this;},limit:async()=>({data:[{}]})}),rpc:async(name,args)=>{calls.push(name);importIds.push(args.p_import_id);if(++tries===1)return {error:Error('network timeout')};return {data:{archived_count:1}};}}}};
 vm.createContext(context);vm.runInContext(source.slice(start,end)+'\nglobalThis.upload=conditionalUpload;',context);
 await context.upload(table,[{}],table==='data_clients'?'hash_clients':'hash_stock',true);
 return {calls,importIds,committed:context.committedMetadataKeys};
}
(async()=>{
 let result=await run('data_clients');assert.deepEqual(result.calls,['replace_client_catalog_v1','replace_client_catalog_v1']);assert.deepEqual(result.importIds,['import-once','import-once']);assert.ok(result.committed.has('hash_clients'));
 result=await run('data_clients',true);assert.deepEqual(result.calls,[]);
 result=await run('data_stock');assert.deepEqual(result.calls,['clear:data_stock','upload:data_stock']);
 const first=source.indexOf('                // Cached client data is a processing reference'),last=source.indexOf("                await conditionalUpload('data_stock'",first);
 for(const hasFile of [false,true]){const writes=[];await vm.runInNewContext('(async()=>{'+source.slice(first,last)+'})()',{document:{getElementById:()=>({files:hasFile?[{}]:[]})},data:{clients:[{}]},conditionalUpload:async(...args)=>writes.push(args)});assert.equal(writes.length,hasFile?1:0);}
 console.log('Catalog imports use a single atomic RPC, retry the same import id, skip unchanged or omitted files, and preserve other upload behavior.');
})().catch(error=>{console.error(error);process.exitCode=1;});

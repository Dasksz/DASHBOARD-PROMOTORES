const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const integrity=require('../js/app/import-integrity.js');
const {webcrypto}=require('node:crypto');
test('activity codes never become networks; named networks are retained',()=>{
 assert.equal(integrity.network([105,'30',null]),'N/A');
 assert.equal(integrity.network(['105','LOJAS AMERICANAS']),'LOJAS AMERICANAS');
 assert.equal(integrity.network(['N/A','  REDE NOVA  ']),'REDE NOVA');
});
test('repeated content is collapsed but distinct movements are preserved',async()=>{
 const base={ID:'old',PEDIDO:'1',PRODUTO:'42',VLVENDA:10,DTPED:123};
 const rows=integrity.rowsForUpload('data_detailed',[base,{...base,ID:'copy'},{...base,VLVENDA:11}],false,(_,v)=>v);
 assert.equal(rows.length,2);
 await integrity.assignStableIds('data_detailed',rows,webcrypto);
 const again=integrity.rowsForUpload('data_detailed',[{...base,ID:'different'}],false,(_,v)=>v);
 await integrity.assignStableIds('data_detailed',again,webcrypto);
 assert.equal(rows[0].id,again[0].id);assert.notEqual(rows[0].id,rows[1].id);
});
test('technical timestamps do not multiply survey rows',()=>{
 const rows=integrity.rowsForUpload('data_nota_perfeita',[{codigo_cliente:'1',semana:'a',nota_media:80,updated_at:'old'},{codigo_cliente:'1',semana:'a',nota_media:80,updated_at:'new'},{codigo_cliente:'1',semana:'b',nota_media:80}],false,(_,v)=>v);
 assert.equal(rows.length,2);
});
const init=fs.readFileSync('js/init.js','utf8');
function fetchHarness(pages){
 let calls=0;
 const ctx={console:{log(){},warn(){},error(){}},setTimeout:fn=>{queueMicrotask(fn)},parseCSVToColumnar(){throw Error('not used')},parseCSVToObjects(){throw Error('not used')},supabaseClient:{from(){const response=pages[calls++];return {select(){return this},order(){return this},limit(){return this},gt(){return this},then(ok,bad){return Promise.resolve(response).then(ok,bad)}}}}};
 // Real timeout handlers are not needed by the fake response; suppress only long timers.
 ctx.setTimeout=(fn,ms)=>{if(ms<30000)queueMicrotask(fn)};
 vm.createContext(ctx);
 const a=init.indexOf('            const fetchAll = async');const b=init.indexOf('            let detailed,',a);
 vm.runInContext(init.slice(a,b)+'\nthis.fetchAll=fetchAll;',ctx);return ctx.fetchAll;
}
test('all pages must be present before a fetch resolves',async()=>{
 const rows=Array.from({length:1000},(_,i)=>({id:i}));
 const fetch=fetchHarness([{data:rows,count:1001},{data:[{id:1000}],count:1}]);
 assert.equal((await fetch('data_detailed')).length,1001);
});
test('server cap below requested page size cannot silently truncate a table',async()=>{
 const fetch=fetchHarness([{data:[{id:1}],count:2}]);
 await assert.rejects(fetch('data_detailed'),/Carga incompleta/);
});
test('failed later page never returns the earlier partial data',async()=>{
 const rows=Array.from({length:1000},(_,i)=>({id:i}));
 const fetch=fetchHarness([{data:rows,count:1001},...Array.from({length:4},()=>({error:{message:'network failure'}}))]);
 await assert.rejects(fetch('data_detailed'));
});
test('PDF perfect stores use monthly mean and are independent of row ordering',()=>{
 const src=fs.readFileSync('js/app/app.js','utf8');
 const a=src.indexOf('        const filialMap = new Map();',src.indexOf('async function exportLpPDF'));
 const b=src.indexOf('        // Header and Titles',a);
 for(const scores of [[100,10],[10,100]]){
 const ctx={data:scores.map(n=>({pesquisador:'promotor15',codigo_cliente:'1',filial:'05',nota_media:n})),isPromoterMode:true,normalizeKey:String,lpResearcherMap:new Map(),optimizedData:{promotorMap:new Map()},window:{normalizeResearcherCode:x=>x}};
 vm.createContext(ctx);const result=vm.runInContext(src.slice(a,b)+'filialMap',ctx);
 assert.equal(result.get('05').get('promotor15').lojasPerfeitas.size,0);
 }
});

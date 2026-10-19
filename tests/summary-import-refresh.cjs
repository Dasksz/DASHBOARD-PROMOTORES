const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const {waitForSummary}=require('../js/app/import-integrity.js');
const source = fs.readFileSync(path.join(__dirname, '../js/app/app.js'), 'utf8');
const start=source.indexOf('        let dashboardSummaryPending = false;');
const end=source.indexOf('        async function enviarDadosParaSupabase(data)',start);
assert.ok(start>=0 && end>start);
async function monitor(ready,fail=false){
 const events=[],elements=new Map(['status-container','status-text','progress-bar','generate-btn'].map(id=>[id,{classList:{remove(){}},style:{},textContent:''}]));
 const context=vm.createContext({document:{getElementById:id=>elements.get(id)},console:{warn(){}},setTimeout:fn=>fn(),window:{PrimeImportIntegrity:{waitForSummary:async()=>{if(fail)throw Error('offline');return ready;}},supabaseClient:{rpc(){}},location:{reload:()=>events.push('reload')},showToast:type=>events.push(type)}});
 vm.runInContext(source.slice(start,end),context);
 await vm.runInContext('acompanharResumoDoUpload()',context);
 const pending=vm.runInContext('dashboardSummaryPending',context);
 if(ready&&!fail){assert.equal(pending,false);assert.deepEqual(events,['success','reload']);}
 else{assert.equal(pending,true);assert.deepEqual(events,['warning']);assert.equal(elements.get('generate-btn').textContent,'Acompanhar atualização');}
}
(async()=>{
 let time=0,calls=0;
 assert.equal(await waitForSummary(async()=>({data:{status:++calls>50?'current':'pending'}}),{now:()=>time,sleep:async ms=>{time+=ms;}}),true);
 assert.ok(time>180000,'valid rebuild can exceed the old three minute deadline');
 time=0;
 assert.equal(await waitForSummary(async()=>({data:{status:'pending'}}),{timeoutMs:10000,now:()=>time,sleep:async ms=>{time+=ms;}}),false);
 await assert.rejects(waitForSummary(async()=>({error:Error('offline')})));
 await assert.rejects(waitForSummary(async()=>({data:null})));
 await monitor(true);await monitor(false);await monitor(false,true);
 // Clicking again after a pending rebuild must only poll, before file parsing or any writes.
 const handler=source.slice(source.indexOf("generateBtn.addEventListener('click'"),source.indexOf('// Initialize Worker',source.indexOf("generateBtn.addEventListener('click'")));
 const guard=handler.slice(handler.indexOf('if (dashboardSummaryPending)'),handler.indexOf('const salesFile'));
 let polled=0;const button={classList:{remove(){}},disabled:true};
 vm.runInNewContext('(function(){'+guard+'throw Error("Upload replayed");})()',{dashboardSummaryPending:true,acompanharResumoDoUpload:()=>{polled++;return Promise.resolve();},generateBtn:button});
 assert.equal(polled,1);
 // Omitted history cannot delete/reinsert cached data, even with a different hash.
 const hstart=source.indexOf('                const hasHistoryFile =');
 const hend=source.indexOf("                await conditionalUpload('data_orders'",hstart);
 for(const hasFile of [false,true]){
  const writes=[];await vm.runInNewContext('(async()=>{'+source.slice(hstart,hend)+'})()',{document:{getElementById:()=>({files:hasFile?[{}]:[]})},data:{history:{length:127706}},forbiddenDimCols:[],sanitizeColumnarForUpload:x=>x,conditionalUpload:async(...args)=>writes.push(args)});
  assert.equal(writes.length,hasFile?1:0);if(hasFile)assert.equal(writes[0][6],true);
 }
 console.log('Upload waits for long rebuilds, reports pending without replay, and preserves omitted history: OK');
})().catch(error=>{console.error(error);process.exitCode=1;});

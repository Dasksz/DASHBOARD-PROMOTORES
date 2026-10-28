const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../js/app/location-service.js'),'utf8');
const raw='Failed to request location updates: com.google.android.gms.common.api.ApiException: 19: DeadObjectException: null';
function setup(handler){
 const calls=[],timers=new Map();let id=0;
 const context={window:{navigator:{geolocation:{getCurrentPosition(ok,bad,options){calls.push(options);handler(ok,bad,options,calls.length);}}}},Date,Number,String,Error,Promise,console:{warn(){}},
  setTimeout(fn){const key=++id;timers.set(key,fn);return key;},clearTimeout:key=>timers.delete(key)};
 vm.createContext(context);vm.runInContext(source,context);return {service:context.window.PrimeLocation,calls,timers};
}
(async()=>{
 const pos={coords:{latitude:-12,longitude:-38,accuracy:10},timestamp:Date.now()};
 const recovered=setup((ok,bad,options,n)=>n===1?bad({code:2,message:raw}):ok(pos));
 assert.equal(await recovered.service.getCurrentPosition(),pos);
 assert.deepEqual(recovered.calls.map(c=>c.enableHighAccuracy),[true,false]);assert.ok(recovered.calls.every(c=>c.maximumAge===0));
 const failed=setup((ok,bad)=>bad({code:2,message:raw}));
 const first=failed.service.getCurrentPosition(),second=failed.service.getCurrentPosition();assert.equal(first,second,'concurrent requests must share a single attempt');
 await assert.rejects(first,error=>{assert.equal(error.attempts.length,2);assert.ok(error.attempts.every(a=>a.device_message.includes('DeadObjectException')));assert.ok(!error.message.includes('com.google'));return true;});
 const denied=setup((ok,bad)=>bad({code:1,message:'Denied'}));await assert.rejects(denied.service.getCurrentPosition());assert.equal(denied.calls.length,1);
 const stale=setup(ok=>ok({...pos,timestamp:Date.now()-120000}));await assert.rejects(stale.service.getCurrentPosition());
 const invalid=setup(ok=>ok({coords:{latitude:NaN,longitude:0}}));await assert.rejects(invalid.service.getCurrentPosition());
 assert.equal(failed.timers.size,0);assert.equal(recovered.timers.size,0);
 console.log('GPS service passed: Android DeadObjectException reproduced, fresh fallback recovery, persistent failure, request deduplication, permission denial, stale/invalid position rejection and safe messages.');
})().catch(e=>{console.error(e);process.exitCode=1;});

const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../js/app/app.js'),'utf8').replace(/\r\n/g,'\n');
const geo=source.slice(source.indexOf('    // --- GEO UPDATE LOGIC ---'),source.indexOf('    async function fazerCheckOut()'));
function setup(location, concurrentLocation) {
  const nodes=new Map(),writes=[],markers=[]; let surveys=0,stored=location,readError=false,writeError=false;
  const element=id=>{if(!nodes.has(id)){const classes=new Set(['hidden']);nodes.set(id,{id,disabled:false,textContent:'',classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c),toggle(c,on){on?classes.add(c):classes.delete(c);}}});}return nodes.get(id);};
  const map={setView(){return map;},invalidateSize(){},removeLayer(){},fitBounds(){}};
  const chain=()=>{let payload,options; const q={select(){return q;},eq(){return q;},upsert(p,o){payload=p;options=o;return q;},
    maybeSingle:async()=>{if(readError)return {error:{message:'read failed'}};if(payload){writes.push(payload);if(concurrentLocation){stored=concurrentLocation;return {data:null};}stored={lat:payload.lat,lng:payload.lng};}return {data:stored};},
    single:async()=>{if(writeError)return {error:{message:'write failed'}};writes.push(payload);stored={lat:payload.lat,lng:payload.lng};return {data:{client_code:payload.client_code}};}};return q;};
  const c={console,Math,Number,Date,String,Error,Promise,document:{getElementById:element},window:{showToast(){},supabaseClient:{from:chain},PrimeLocation:{getCurrentPosition:()=>new Promise((resolve,reject)=>c.navigator.geolocation.getCurrentPosition(resolve,reject)),message:()=> 'Localização indisponível.'}},
    normalizeKey:String,clientCoordinatesMap:new Map([['999999',{lat:50,lng:50}]]),visitaAbertaId:42,currentActionClientCode:'999999',
    abrirPesquisa:async()=>{surveys++;},navigator:{geolocation:{getCurrentPosition:resolve=>resolve({coords:{latitude:0,longitude:0}})}},
    L:{map:()=>map,tileLayer:()=>({addTo(){}}),Icon:function(){},latLngBounds:x=>x,marker:(position,options)=>{markers.push({position,options});return {addTo(){return this;},bindPopup(){},on(){}};}}};
  vm.createContext(c);vm.runInContext(geo,c);
  return {c,nodes,element,writes,markers,get surveys(){return surveys;},get stored(){return stored;},failRead(){readError=true;},failWrite(){writeError=true;}};
}
const pos={coords:{latitude:0,longitude:0}};
(async()=>{
  const near=setup({lat:0,lng:0.0005});await near.c.handleCheckInLocation('999999',pos);
  assert.equal(near.surveys,1);assert.equal(near.writes.length,0);
  const edge=setup({lat:0,lng:100/6371000*180/Math.PI});await edge.c.handleCheckInLocation('999999',pos);assert.equal(edge.surveys,1,'100 m remains in radius');
  const far=setup({lat:0,lng:0.002});await far.c.handleCheckInLocation('999999',pos);
  assert.equal(far.surveys,0);assert.equal(far.element('modal-geo-update').classList.contains('hidden'),false);
  assert.match(far.element('geo-update-description').textContent,/100 metros/);assert.equal(far.markers[0].options.draggable,false);
  await far.element('btn-decline-geo-update').onclick();assert.equal(far.writes.length,0);assert.equal(far.surveys,1);
  const yes=setup({lat:0,lng:0.002});await yes.c.handleCheckInLocation('999999',pos);await yes.element('btn-confirm-geo-update').onclick();
  assert.equal(yes.writes.length,1);assert.equal(yes.stored.lat,0);assert.equal(yes.stored.lng,0);assert.equal(yes.surveys,1);
  const absent=setup(null);await absent.c.handleCheckInLocation('999999',pos);
  assert.equal(absent.writes.length,1);assert.equal(absent.surveys,1);assert.equal(absent.stored.lat,0);
  const race=setup(null,{lat:0,lng:0.002});await race.c.handleCheckInLocation('999999',pos);
  assert.equal(race.stored.lng,0.002,'concurrent coordinate is not overwritten');assert.equal(race.surveys,0);
  const failure=setup({lat:0,lng:0.002});failure.failRead();await failure.c.handleCheckInLocation('999999',pos);assert.equal(failure.writes.length,0);
  const failedSave=setup({lat:0,lng:0.002});await failedSave.c.handleCheckInLocation('999999',pos);failedSave.failWrite();await failedSave.element('btn-confirm-geo-update').onclick();
  assert.equal(failedSave.surveys,0);assert.equal(failedSave.element('modal-geo-update').classList.contains('hidden'),false);
  console.log('Location flow passed: within radius, 100 m boundary, discrepancy, yes/no, exact check-in coordinates, absent location, concurrent registration and error handling.');
})().catch(error=>{console.error(error);process.exitCode=1;});

// node tests/coverage-weekly-parity.cjs <snapshot autorizada> <respostas RPC> <dimensões>
// As snapshots com dados reais ficam fora do repositório.
const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm'),path=require('node:path');
const [dataPath,resultPath,dimensionPath]=process.argv.slice(2);if(!dimensionPath)throw new Error('Informe snapshot, respostas e dimensões');
const data=JSON.parse(fs.readFileSync(dataPath)),results=JSON.parse(fs.readFileSync(resultPath)),dims=JSON.parse(fs.readFileSync(dimensionPath));
const products=new Map(data.products.map(p=>[p.code,p])),descs=new Map(dims.products.map(p=>[p.codigo,p.descricao]));let checks=0;
const close=(actual,expected,label)=>{checks++;assert.ok(Number.isFinite(actual)&&Math.abs(actual-expected)<1e-6,`${label}: RPC=${actual}, JS=${expected}`);};
const key=d=>new Date(d).toISOString().slice(0,10),month=d=>key(d).slice(0,7);
const shiftMonth=date=>{const d=new Date(date+'T00:00:00Z'),day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-1);const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));return key(d);};
const sum=(rows,fn)=>rows.reduce((v,s)=>v+fn(s),0),amount=s=>Number(s.vlvenda)||0,boxes=s=>(Number(s.qtvenda)||0)/(Number(products.get(s.produto)?.master)>0?Number(products.get(s.produto).master):1);
const supplier=(s,f)=>!f.suppliers?.length||f.suppliers.includes(s.codfor)||(s.codfor==='1119'&&f.suppliers.includes((d=>d.includes('TODDYNHO')?'1119_TODDYNHO':d.includes('TODDY')?'1119_TODDY':d.includes('QUAKER')||d.includes('KEROCOCO')?'1119_QUAKER_KEROCOCO':null)((descs.get(s.produto)||'').toUpperCase())));
const rede=(c,f)=>f.rede_group==='com_rede'?!!c?.rede&&c.rede!=='N/A'&&(!f.redes?.length||f.redes.includes(c.rede)):f.rede_group==='sem_rede'?!c?.rede||c.rede==='N/A':true;
const clientMap=new Map(data.clients.map(c=>[c.code,c]));
const branches=new Map();for(const s of [...data.sales].sort((a,b)=>a.source.localeCompare(b.source)||key(b.dtped).localeCompare(key(a.dtped))))if(!branches.has(s.codcli))branches.set(s.codcli,s.filial);
const legacy=fs.readFileSync(path.join(__dirname,'../js/app/app.js'),'utf8');const begin=legacy.indexOf('        function getWorkingMonthWeeks('),end=legacy.indexOf('        function calculateHistoricalBests()',begin);const ctx={Date};vm.createContext(ctx);vm.runInContext(legacy.slice(begin,end),ctx);
for(const sample of results){
 const f=sample.filters,r=sample.coverage,tag=`cenário ${sample.id}`;
 const clients=data.clients.filter(c=>(!f.filial||['ambas','all'].includes(f.filial)||branches.get(c.code)===f.filial)&&rede(c,f)&&(!f.city||c.city?.toLowerCase()===f.city));const codes=new Set(clients.map(c=>c.code));
 const scoped=data.sales.filter(s=>codes.has(s.codcli)&&(!f.filial||['ambas','all'].includes(f.filial)||s.filial===f.filial)&&supplier(s,f)&&(!f.products?.length||f.products.includes(s.produto))&&(!f.types?.length||f.types.includes(s.tipovenda)));
 const histTotals=new Map();for(const s of scoped)if(s.source==='history')histTotals.set(s.codcli,(histTotals.get(s.codcli)||0)+amount(s));
 close(r.active_clients,clients.length,tag+' base');close(r.active_3m,[...histTotals.values()].filter(v=>v>=1).length,tag+' ativos histórico');
 const filtered=scoped.filter(s=>f.price_min==null&&f.price_max==null||Number(s.qtvenda)!==0&&(f.price_min==null||amount(s)/s.qtvenda>=f.price_min)&&(f.price_max==null||amount(s)/s.qtvenda<=f.price_max));
 const custom=f.date_start&&f.date_end,prevMonth=shiftMonth(data.ref.slice(0,7)+'-01').slice(0,7);
 const cur=filtered.filter(s=>custom?key(s.dtped)>=f.date_start&&key(s.dtped)<=f.date_end:s.source==='current');const prev=filtered.filter(s=>custom?key(s.dtped)>=shiftMonth(f.date_start)&&key(s.dtped)<=shiftMonth(f.date_end):s.source==='history'&&month(s.dtped)===prevMonth);
 const alt=f.types?.length&&!f.types.includes('1')&&!f.types.includes('9');const value=s=>alt?(Number(s.vlbonific)||0):amount(s);
 const counts=rows=>{const m=new Map();for(const s of rows)m.set(s.codcli,(m.get(s.codcli)||0)+value(s));return[...m.values()].filter(v=>v>=1).length;};
 close(r.current_clients,counts(cur),tag+' clientes atuais');close(r.previous_clients,counts(prev),tag+' clientes anteriores');close(r.chart_total,sum(cur,f.metric==='revenue'?value:boxes),tag+' gráfico total');
 const productCodes=new Set([...cur,...prev].map(s=>s.produto));const expected=[];
 for(const code of productCodes){const c=cur.filter(s=>s.produto===code),p=prev.filter(s=>s.produto===code),cBox=sum(c,boxes),pBox=sum(p,boxes),cc=counts(c),pc=counts(p);if(cBox>0)expected.push({code,cBox,pBox,cc,pc});}
 close(r.rows.length,expected.length,tag+' produtos');close(r.total_boxes,sum(expected,x=>x.cBox),tag+' total caixas');
 for(const e of expected){const actual=r.rows.find(x=>x.code===e.code);assert.ok(actual,tag+' '+e.code);close(actual.boxesSoldCurrentMonth,e.cBox,tag+' caixas atuais');close(actual.boxesSoldPreviousMonth,e.pBox,tag+' caixas anteriores');close(actual.clientsCurrentCount,e.cc,tag+' PDV atual');close(actual.clientsPreviousCount,e.pc,tag+' PDV anterior');close(actual.coverageCurrent,clients.length?e.cc/clients.length*100:0,tag+' cobertura produto');if(e.pBox>0)close(actual.boxesVariation,(e.cBox-e.pBox)/e.pBox*100,tag+' var caixas');else assert.equal(actual.boxesVariation,null);if(e.pc>0)close(actual.pdvVariation,(e.cc-e.pc)/e.pc*100,tag+' var PDV');else assert.equal(actual.pdvVariation,e.cc>0?null:0);}
 const w=sample.weekly,target=f.month&&f.month!=='current'?f.month:data.ref.slice(0,7),[yr,mo]=target.split('-').map(Number),weeks=ctx.getWorkingMonthWeeks(yr,mo-1);
 const wFiltered=data.sales.filter(s=>supplier(s,f)&&(!f.filial||['ambas','all'].includes(f.filial)||s.filial===f.filial)&&rede(clientMap.get(s.codcli),f));
 const current=wFiltered.filter(s=>f.month&&f.month!=='current'?s.source==='history'&&month(s.dtped)===target:s.source==='current');
 close(w.weeks.length,weeks.length,tag+' semanas');
 for(let i=0;i<weeks.length;i++){const wk=weeks[i],subset=current.filter(s=>new Date(key(s.dtped)+'T00:00:00Z')>=wk.start&&new Date(key(s.dtped)+'T00:00:00Z')<=wk.end);close(w.weeks[i].total,sum(subset,amount),tag+' total semana');for(let day=0;day<7;day++)close(w.weeks[i].days[day],sum(subset.filter(s=>new Date(s.dtped).getUTCDay()===day),amount),tag+' dia semana');}
 const pMonth=shiftMonth(target+'-01').slice(0,7),daily=new Map();for(const s of wFiltered)if(s.source==='history'&&month(s.dtped)===pMonth)daily.set(key(s.dtped),(daily.get(key(s.dtped))||0)+amount(s));
 for(let day=0;day<7;day++)close(w.best_days[day],Math.max(0,...[...daily].filter(([date])=>new Date(date+'T00:00:00Z').getUTCDay()===day).map(([,v])=>v)),tag+' melhor dia');
 if(current.length){close(w.ranking_fat[0].val,sum(current,amount),tag+' ranking fat');close(w.ranking_pos[0].pos,new Set(current.map(s=>s.codcli)).size,tag+' ranking clientes');}else close(w.ranking_fat.length,0,tag+' ranking vazio');
}
console.log(`${results.length} combinações reais, ${data.sales.length} linhas, ${checks} valores conferidos entre JS e RPC: OK`);

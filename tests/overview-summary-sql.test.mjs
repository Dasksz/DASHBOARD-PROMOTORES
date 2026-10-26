import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const {PGlite}=await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const profiles=[['adm','00000000-0000-0000-0000-000000000001',true],['C1','00000000-0000-0000-0000-000000000002',true],['P1','00000000-0000-0000-0000-000000000003',true],['10','00000000-0000-0000-0000-000000000004',true],['S1','00000000-0000-0000-0000-000000000005',true],['blocked','00000000-0000-0000-0000-000000000006',false]];
const clients=[['1','10','A','Rede A'],['2','10','A','N/A'],['3','20','B','Rede B'],['4','30','B','Rede B'],['5','53','C','N/A'],['6','1001','C','N/A'],['7','','A','N/A']].map(([code,rca,city,rede])=>({code,rca,city,rede}));
const nodes={ '1':{coord:{code:'C1',name:'Coord 1'},cocoord:{code:'CC1',name:'Co 1'},promotor:{code:'P1',name:'Promotor 1'}},'2':{coord:{code:'C1',name:'Coord 1'},cocoord:{code:'CC1',name:'Co 1'},promotor:{code:'P1',name:'Promotor 1'}},'3':{coord:{code:'C1',name:'Coord 1'},cocoord:{code:'CC1',name:'Co 1'},promotor:{code:'P2',name:'Promotor 2'}},'4':{coord:{code:'C2',name:'Coord 2'},cocoord:{code:'CC2',name:'Co 2'},promotor:{code:'P3',name:'Promotor 3'}},'6':{coord:{code:'C2',name:'Coord 2'},cocoord:{code:'CC2',name:'Co 2'},promotor:{code:'P3',name:'Promotor 3'}}};
const suppliers={'707':'PEPSICO','708':'PEPSICO','752':'PEPSICO','1119':'PEPSICO','668':'MULTIMARCAS'};
const products={'101':'EXTRUSADOS','102':'NAO EXTRUSADOS','201':'TODDYNHO','202':'TODDY','203':'QUAKER','204':'KEROCOCO','301':'DOCILE','999':'BONUS'};
const rows=[['1','101','707','10','S1','1','F',100,0,10],['1','101','707','10','S1','1','F',20,0,2],['1','999','707','10','S1','5','F',100,20,1],['2','102','708','10','S1','1','F',0.4,0,0.04],['2','102','708','10','S1','9','F',0.4,0,0.04],['3','201','1119','20','S2','1','F',200,0,20],['3','202','1119','20','S2','9','F',150,0,15],['4','203','1119','30','S3','1','B',80,0,8],['4','204','1119','30','S3','1','B',10,0,1],['5','101','752','53','S4','11','F',70,9,7],['99','301','668','10','S1','1','F',50,0,5],['6','102','708','1001','S5','1','F',90,0,9],['4','101','707','30','S3','1','F',-10,0,-1],['7','101','707','CODCLI','S1','1','F',1000,0,100]];
const sales=rows.map(([CODCLI,PRODUTO,CODFOR,CODUSUR,CODSUPERVISOR,TIPOVENDA,POSICAO,VLVENDA,VLBONIFIC,TOTPESOLIQ])=>({CODCLI,PRODUTO,CODFOR,CODUSUR,CODSUPERVISOR,TIPOVENDA,POSICAO,VLVENDA,VLBONIFIC,TOTPESOLIQ,DESCRICAO:products[PRODUTO],OBSERVACAOFOR:suppliers[CODFOR],NOME:CODUSUR,SUPERV:CODSUPERVISOR}));
const supervisor=rca=>'Super '+({'10':'S1','20':'S2','30':'S3','53':'S4','1001':'S5'}[rca]||'S1');
function oracle(role,f){
 const scoped=role==='adm'?clients:role==='C1'?clients.filter(c=>nodes[c.code]?.coord.code==='C1'):role==='P1'?clients.filter(c=>nodes[c.code]?.promotor.code==='P1'):clients.filter(c=>c.rca==='10');
 const base=scoped.filter(c=>['coords','cocoords','promotors'].every((key,i)=>!f[key]?.length||f[key].includes(nodes[c.code]?.[['coord','cocoord','promotor'][i]]?.code))).filter(c=>f.mode!=='seller'||!f.supervisors?.length||f.supervisors.includes(supervisor(c.rca))).filter(c=>!f.sellers?.length||f.sellers.includes(c.rca));
 const portfolio=base.filter(c=>f.rede_group==='com_rede'?c.rede!=='N/A'&&(!f.redes?.length||f.redes.includes(c.rede)):f.rede_group==='sem_rede'?c.rede==='N/A':true);
 const scopedCodes=new Set(scoped.map(c=>c.code)),baseCodes=new Set(base.map(c=>c.code)),portfolioCodes=new Set(portfolio.map(c=>c.code));
 const filtered=sales.filter(r=>r.CODUSUR!=='CODCLI').filter(r=>role==='adm'||scopedCodes.has(r.CODCLI)||(['10','S1'].includes(role)&&r.CODUSUR==='10')).filter(r=>base.length===scoped.length||baseCodes.has(r.CODCLI)).filter(r=>!f.client||r.CODCLI===f.client).filter(r=>!f.position||r.POSICAO===f.position).filter(r=>!f.pasta||r.OBSERVACAOFOR===f.pasta).filter(r=>!f.types?.length||f.types.includes(r.TIPOVENDA)).filter(r=>!f.rede_group||portfolioCodes.has(r.CODCLI)).filter(r=>{const virtual=r.CODFOR==='1119'?(r.DESCRICAO.includes('TODDYNHO')?'1119_TODDYNHO':r.DESCRICAO.includes('TODDY')?'1119_TODDY':'1119_QUAKER_KEROCOCO'):null;return !f.suppliers?.length||f.suppliers.includes(r.CODFOR)||f.suppliers.includes(virtual)});
 const source=read('js/app/app.js');const a=source.indexOf('        function calculateSummaryFromData('),b=source.indexOf('        const isObject',a);
 const ctx={Map,Set,selectedTiposVenda:f.types||[],FORBIDDEN_KEYS:[],normalize:s=>s.toUpperCase(),isAlternativeMode:types=>types.length>0&&!types.includes('1')&&!types.includes('9'),getValueForSale:(r,types)=>types.length>0&&!types.includes('1')&&!types.includes('9')?r.VLBONIFIC:r.VLVENDA,optimizedData:{clientHierarchyMap:new Map(Object.entries(nodes))},window:{SUPPLIER_CODES:{ELMA:['707','708','752'],FOODS:['1119']}}};vm.createContext(ctx);vm.runInContext(source.slice(a,b),ctx);return ctx.calculateSummaryFromData(filtered,true,portfolio);
}
async function database(){const db=new PGlite();await db.exec(read('tests/fixtures/overview-bootstrap.sql'));for(const [role,id,approved]of profiles)await db.query('insert into profiles values($1,$2,$3)',[id,role,approved]);for(const c of clients)await db.query('insert into data_clients values($1,$2,$3,$4,$5,$5)',[c.code,c.rca,c.city,c.rede,c.code==='6'?'AMERICANAS':'Cliente '+c.code]);for(const [code,node]of Object.entries(nodes))await db.query('insert into data_client_promoters values($1,$2)',[code,node.promotor.code]);for(const p of ['P1','P2','P3']){const node=Object.values(nodes).find(n=>n.promotor.code===p);await db.query('insert into data_hierarchy values($1,$2,$3,$4,$5,$6,$7)',[crypto.randomUUID(),node.coord.code,node.coord.name,node.cocoord.code,node.cocoord.name,p,node.promotor.name]);}for(const s of ['S1','S2','S3','S4','S5'])await db.query('insert into dim_supervisores values($1,$2)',[s,'Super '+s]);for(const [k,v]of Object.entries(suppliers))await db.query('insert into dim_fornecedores values($1,$2,$2)',[k,v]);for(const [k,v]of Object.entries(products))await db.query('insert into dim_produtos values($1,$2)',[k,v]);for(const r of rows)await db.query('insert into data_detailed values('+r.map((_,i)=>'$'+(i+1)).join(',')+')',r);for(const c of clients)await db.query('insert into dashboard_private.client_assignments values($1,$2,null,null,null,$3,$4,$5)',[c.code,c.rca,'current','2026-10-26',({'10':'S1','20':'S2','30':'S3','53':'S4','1001':'S5'}[c.rca]||'S1')]);await db.exec(read('tests/fixtures/overview-existing-helpers.sql'));await db.exec(read('SQL/overview_summary_rpc_v1.sql'));return db;}
test('RPC SQL matches the actual JavaScript summary for roles and filter combinations',async()=>{const db=await database();let compared=0;try{for(const [role,id]of profiles.filter(p=>p[0]!=='blocked')){await db.query("select set_config('test.uid',$1,false)",[id]);await db.exec('set role authenticated');for(const mode of ['promoter','seller'])for(const suppliers of [[],['707'],['1119'],['1119_TODDY'],['707','708']])for(const types of [[],['1'],['5'],['1','5'],['11']])for(const extra of [{},{coords:['C1']},{promotors:['P1']},{sellers:['10']},{supervisors:['Super S1']},{rede_group:'com_rede',redes:['Rede A']},{rede_group:'sem_rede'},{position:'B'},{client:'1'},{pasta:'MULTIMARCAS'}]){const f={mode,suppliers,types,...extra};const actual=(await db.query('select public.get_overview_summary_v1($1) result',[f])).rows[0].result;const expected=oracle(role,f);for(const key of ['totalFaturamento','totalPeso','skuPdv','positivacaoCount','positivacaoPercent','totalRelevantClients'])assert.ok(Math.abs(actual[key]-expected[key])<1e-8,JSON.stringify({role,f,key,actual:actual[key],expected:expected[key]}));for(const key of ['vendasPorCoord','vendasPorCoCoord','vendasPorPromotor']){assert.deepEqual(Object.keys(actual[key]).sort(),Object.keys(expected[key]).sort(),JSON.stringify({role,f,key}));for(const name of Object.keys(expected[key]))assert.ok(Math.abs(actual[key][name]-expected[key][name])<1e-8,JSON.stringify({role,f,key,name}));}compared++;}await db.exec('reset role');}assert.equal(compared,2500);}finally{await db.close();}});
test('session authorization cannot be spoofed by filter values; anonymous and unapproved access denied',async()=>{const db=await database();try{await db.exec('set role authenticated');await assert.rejects(db.query('select public.get_overview_summary_v1($1)',[{role:'adm',scope:{kind:'admin'}}]),e=>e.code==='42501');await db.query("select set_config('test.uid',$1,false)",[profiles.find(p=>p[0]==='blocked')[1]]);await assert.rejects(db.query('select public.get_overview_summary_v1($1)',[{}]),e=>e.code==='42501');await db.query("select set_config('test.uid',$1,false)",[profiles.find(p=>p[0]==='P1')[1]]);const a=(await db.query('select public.get_overview_summary_v1($1) result',[{role:'adm',scope:{kind:'admin'}}])).rows[0].result;assert.equal(a.totalRelevantClients,2);for(const bad of [{types:'1'},{types:[1]},{mode:'admin'}])await assert.rejects(db.query('select public.get_overview_summary_v1($1)',[bad]),e=>e.code==='22023');await db.exec('reset role;set role anon');await assert.rejects(db.query('select public.get_overview_summary_v1($1)',[{}]),e=>e.code==='42501');}finally{await db.close();}});
test('fresh SQL reads reflect inserts, updates and deletes without any cache refresh',async()=>{const db=await database();try{await db.query("select set_config('test.uid',$1,false)",[profiles[0][1]]);await db.exec('set role authenticated');const read=async()=> (await db.query('select public.get_overview_summary_v1($1) result',[{suppliers:['707'],position:'F',client:'7'}])).rows[0].result;const before=await read();assert.equal(before.totalFaturamento,0);assert.equal(before.positivacaoCount,0);await db.exec('reset role');await db.query("insert into data_detailed values('7','101','707','10','S1','1','F',10,0,2)");await db.exec('set role authenticated');const inserted=await read();assert.equal(inserted.totalFaturamento,10);assert.equal(inserted.totalPeso,2);assert.equal(inserted.positivacaoCount,1);assert.equal(inserted.skuPdv,1);await db.exec('reset role');await db.query("update data_detailed set vlvenda=0.5,totpesoliq=0.1 where codcli='7' and codusur='10'");await db.exec('set role authenticated');const updated=await read();assert.equal(updated.totalFaturamento,0.5);assert.equal(updated.totalPeso,0.1);assert.equal(updated.positivacaoCount,0);await db.exec('reset role');await db.query("delete from data_detailed where codcli='7' and codusur='10'");await db.exec('set role authenticated');const deleted=await read();assert.equal(deleted.totalFaturamento,before.totalFaturamento);assert.equal(deleted.positivacaoCount,before.positivacaoCount);}finally{await db.close();}});

async function facetDatabase(){
 const db=await database();
 await db.exec(`ALTER TABLE data_clients ADD COLUMN id serial, ADD COLUMN fantasia text, ADD COLUMN cnpj_cpf text, ADD COLUMN bairro text;
 ALTER TABLE data_history ADD COLUMN codcli text, ADD COLUMN codfor text;
 CREATE TABLE dim_vendedores(codigo text PRIMARY KEY,nome text);
 GRANT SELECT ON dim_vendedores TO authenticated;
 INSERT INTO dim_vendedores VALUES('10','Vendedor A'),('20','Vendedor B'),('30','Vendedor C');
 INSERT INTO dim_fornecedores VALUES('9999','Histórico apenas','MULTIMARCAS');
 INSERT INTO data_history VALUES('10','S1','1','9999');
 UPDATE data_clients SET fantasia='Loja Azul',cnpj_cpf='12.345.678/0001-99',bairro='Centro' WHERE codigo_cliente='1';`);
 await db.exec(read('SQL/overview_filters_rpc_v1.sql'));return db;
}
const facetCodes=(f,k)=>f[k].map(o=>o.code).sort();
test('facets keep multi-selection, parent cascades, historical suppliers and independent lists',async()=>{
 const db=await facetDatabase();try{
  await db.query("select set_config('test.uid',$1,false)",[profiles[0][1]]);await db.exec('set role authenticated');
  const get=async f=>(await db.query('select get_overview_filters_v1($1) result',[f])).rows[0].result;
  const base=await get({});assert.deepEqual(facetCodes(base,'coords'),['C1','C2']);assert.deepEqual(facetCodes(base,'sellers'),['10','1001','20','30','53']);assert.ok(facetCodes(base,'suppliers').includes('9999'));assert.ok(!facetCodes(base,'suppliers').includes('1119'));assert.equal(base.suppliers.filter(o=>o.code.startsWith('1119_')).length,3);
  for(const supplier of ['707','1119_TODDY','missing'])for(const type of ['1','5','missing'])for(const position of ['F','M']){
   const f=await get({suppliers:[supplier],types:[type],position,client:'missing',rede_group:'com_rede',redes:['missing']});
   for(const key of ['coords','cocoords','promotors','sellers','supervisors','types','redes'])assert.deepEqual(facetCodes(f,key),facetCodes(base,key),key);
  }
  assert.deepEqual(facetCodes(await get({coords:['C1']}),'cocoords'),['CC1']);assert.deepEqual(facetCodes(await get({coords:['C1','C2']}),'promotors'),['P1','P2','P3']);assert.deepEqual(facetCodes(await get({promotors:['P1']}),'sellers'),['10']);
  assert.deepEqual(facetCodes(await get({mode:'seller',supervisors:['Super S1']}),'sellers'),['10']);assert.deepEqual(facetCodes(await get({mode:'seller',supervisors:['Super S1','Super S2']}),'sellers'),['10','20']);
  assert.deepEqual(await get({}),base);assert.deepEqual(facetCodes(await get({supplier_client:'1',supplier_pasta:'MULTIMARCAS'}),'suppliers'),['9999']);
  const empty=await get({coords:['none']});assert.deepEqual(empty.promotors,[]);assert.deepEqual(empty.cocoords,[]);assert.deepEqual(empty.sellers,[]);
  for(const bad of [[],{mode:'admin'},{coords:'C1'},{coords:[1]}])await assert.rejects(db.query('select get_overview_filters_v1($1)',[bad]),e=>e.code==='22023');
 }finally{await db.close();}
});
test('facet/search authorization, literal search and updates without cache refresh',async()=>{
 const db=await facetDatabase();try{
  const get=async()=>(await db.query('select get_overview_filters_v1($1) result',[{}])).rows[0].result;
  const search=async q=>(await db.query('select search_overview_clients_v1($1) result',[q])).rows[0].result;
  await db.exec('set role authenticated');await assert.rejects(get(),e=>e.code==='42501');await db.query("select set_config('test.uid',$1,false)",[profiles[5][1]]);await assert.rejects(get(),e=>e.code==='42501');
  await db.query("select set_config('test.uid',$1,false)",[profiles[2][1]]);assert.deepEqual(facetCodes(await get(),'promotors'),['P1']);assert.deepEqual(facetCodes(await get(),'sellers'),['10']);
  assert.deepEqual(await search('Cliente 4'),[]);assert.equal((await search('azul'))[0].code,'1');assert.equal((await search('12.345.678'))[0].code,'1');assert.equal((await search('azul%centro'))[0].promotor,'P1');assert.deepEqual(await search('%%%'),[]);assert.deepEqual(await search("' OR 1=1 --"),[]);
  await db.query("select set_config('test.uid',$1,false)",[profiles[0][1]]);await db.exec('reset role');await db.exec("UPDATE dim_vendedores SET nome='Nome atualizado' WHERE codigo='10'; INSERT INTO data_detailed VALUES('1','101','707','10','S1','77','F',1,0,1)");
  await db.exec('set role authenticated');const updated=await get();assert.equal(updated.sellers.find(o=>o.code==='10').label,'Nome atualizado');assert.ok(facetCodes(updated,'types').includes('77'));
  await db.exec('reset role');await db.exec("DELETE FROM data_detailed WHERE tipovenda='77'");await db.exec('set role authenticated');assert.ok(!facetCodes(await get(),'types').includes('77'));
  await db.exec('reset role;set role anon');await assert.rejects(get(),e=>e.code==='42501');await assert.rejects(search('azul'),e=>e.code==='42501');
 }finally{await db.close();}
});
test('supplier/type/rede RPC options match the actual legacy JS renderers',async()=>{
 const db=await facetDatabase();try{
  await db.query("select set_config('test.uid',$1,false)",[profiles[0][1]]);await db.exec('set role authenticated');
  const get=async f=>(await db.query('select get_overview_filters_v1($1) result',[f])).rows[0].result;
  const names={...suppliers,'9999':'Histórico apenas'};
  const window={escapeHtml:String,resolveDim:(kind,code)=>names[code]||code,SUPPLIER_CODES:{ELMA:['707','708','752'],FOODS:['1119'],VIRTUAL:{TODDY:'1119_TODDY',TODDYNHO:'1119_TODDYNHO',QUAKER_KEROCOCO:'1119_QUAKER_KEROCOCO'}}};
  const ctx=vm.createContext({window,document:{getElementById:()=>null}});const src=read('js/app/utils.js');
  for(const name of ['Supplier','TipoVenda','Rede']){const start=src.indexOf('    window.updateGeneric'+name+'Filter =');const end=src.indexOf('\n    };',start)+7;vm.runInContext(src.slice(start,end),ctx);}
  const codes=html=>[...html.matchAll(/ value="([^"]*)"/g)].map(m=>m[1]).sort();
  const source=[...sales,{CODCLI:'1',CODFOR:'9999',OBSERVACAOFOR:'MULTIMARCAS'}];
  for(const client of ['', '1','3','4'])for(const pasta of ['','PEPSICO','MULTIMARCAS']){
   const rows=source.filter(r=>(!client||r.CODCLI===client)&&(!pasta||r.OBSERVACAOFOR===pasta));const dd={innerHTML:''},label={};
   window.updateGenericSupplierFilter(dd,label,[],rows,'main');const actual=await get({supplier_client:client,supplier_pasta:pasta});assert.deepEqual(facetCodes(actual,'suppliers'),codes(dd.innerHTML),JSON.stringify({client,pasta}));
  }
  const base=await get({}),dd={innerHTML:''};window.updateGenericTipoVendaFilter(dd,{},[],sales);assert.deepEqual(facetCodes(base,'types'),codes(dd.innerHTML));
  window.updateGenericRedeFilter(dd,{},[],clients.map(c=>({ramo:c.rede})));assert.deepEqual(facetCodes(base,'redes'),codes(dd.innerHTML));
 }finally{await db.close();}
});

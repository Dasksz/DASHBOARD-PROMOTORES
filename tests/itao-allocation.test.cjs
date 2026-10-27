const {test}=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'),vm=require('node:vm');
const ctx={window:{}};vm.createContext(ctx);const code=fs.readFileSync('js/app/utils.js','utf8');vm.runInContext(code.slice(code.indexOf('window.allocateItaoDataset = function')),ctx);const allocate=ctx.window.allocateItaoDataset;
const columnar=rows=>({columns:Object.keys(rows[0]),values:Object.fromEntries(Object.keys(rows[0]).map(k=>[k,rows.map(r=>r[k])])),length:rows.length});
const clients=codes=>({values:{CODIGO_CLIENTE:codes,CIDADE:codes.map(c=>c==='546'?'ILHEUS':'ITABUNA')}});
const base=[{ID:'i',CODCLI:'3297',VLVENDA:5473.91,VLBONIFIC:13,QTVENDA:9,TOTPESOLIQ:90,QTVENDA_EMBALAGEM_MASTER:3,CODUSUR:'78',PRODUTO:'p',CODFOR:'707',CIDADE:'ITABUNA',ESTOQUEUNIT:12},{ID:'other',CODCLI:'999',VLVENDA:17,VLBONIFIC:0,QTVENDA:2,TOTPESOLIQ:3,QTVENDA_EMBALAGEM_MASTER:1,CODUSUR:'1',PRODUTO:'x',CODFOR:'708',CIDADE:'OUTRA',ESTOQUEUNIT:5}];
const sum=(d,k)=>d.values[k].reduce((a,b)=>a+b,0);
test('general totals are conserved for revenue, bonuses, units, boxes and weight; sale is not duplicated',()=>{
 const raw=columnar(base),before=JSON.stringify(raw),result=allocate(raw,clients(['541','544','546','3297','999']));
 for(const k of ['VLVENDA','VLBONIFIC','QTVENDA','TOTPESOLIQ','QTVENDA_EMBALAGEM_MASTER'])assert.ok(Math.abs(sum(raw,k)-sum(result,k))<1e-9,k);
 assert.equal(result.length,4);assert.equal(new Set(result.values.ID).size,4);assert.ok(!result.values.CODCLI.includes('3297'));assert.equal(JSON.stringify(raw),before);
 assert.equal(result.values.CIDADE[2],'ILHEUS');assert.equal(result.values.CODUSUR[2],'78');assert.equal(result.values.ESTOQUEUNIT[2],12);
 assert.equal(allocate(result,clients(['541','544','546'])),result);
});
test('Tiago receives only his client share, product mix, units and volume on every new dataset',()=>{
 const result=allocate(columnar(base),clients(['546']));
 assert.ok(Math.abs(result.values.VLVENDA[0]-5473.91/3)<1e-9);assert.equal(result.values.CODCLI[0],'546');assert.equal(result.values.PRODUTO[0],'p');assert.equal(result.values.TOTPESOLIQ[0],30);
 const updated=allocate(columnar([{...base[0],VLVENDA:6000}]),clients(['546']));assert.equal(updated.values.VLVENDA[0],2000);
});
test('orders support lowercase keys and preserve order number, seller and nonadditive fields',()=>{
 const data=columnar([{id:'o',pedido:'123',codcli:'3297',vlvenda:900,totpesoliq:9,codusur:'78'}]);
 const out=allocate(data,clients(['546']));assert.equal(out.values.codcli[0],'546');assert.equal(out.values.vlvenda[0],300);assert.equal(out.values.totpesoliq[0],3);assert.equal(out.values.pedido[0],'123');assert.equal(out.values.codusur[0],'78');
});
test('unrelated portfolios and source-only seller keep their ordinary dataset untouched',()=>{
 const d=columnar(base);assert.equal(allocate(d,clients(['999'])),d);assert.equal(allocate(d,clients(['3297'])),d);
});

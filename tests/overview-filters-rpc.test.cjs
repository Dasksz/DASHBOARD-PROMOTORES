const {test}=require('node:test');const assert=require('node:assert/strict');
const api=require('../js/app/overview-filters-rpc.js');
const keys=['coords','cocoords','promotors','supervisors','sellers','suppliers','types','redes'];
const payload=()=>({schema_version:1,...Object.fromEntries(keys.map(k=>[k,[]]))});
test('validate full options contract, reject duplicates and malformed search data',()=>{
 assert.equal(api.validateFacets(payload()).schema_version,1);
 for(const bad of [{},{...payload(),sellers:null},{...payload(),suppliers:[{code:1,label:'bad'}]},{...payload(),types:[{code:'1',label:'1'},{code:'1',label:'1'}]}])assert.throws(()=>api.validateFacets(bad));
 assert.deepEqual(api.validateClients([]),[]);assert.throws(()=>api.validateClients([{}]));
});
test('empty results retain selections instead of silently broadening the query',()=>{
 const selected=new Set(['707','708']),old=[{code:'707',label:'EXTRUSADOS'},{code:'708',label:'NÃO EXTRUSADOS'}];
 assert.deepEqual(api.optionsWithSelections([],selected,old),old);assert.deepEqual([...selected],['707','708']);assert.deepEqual(api.optionsWithSelections(old,new Set()),old);
});
test('late success/error and cancelled search cannot replace the latest response; retry works',async()=>{
 const calls=[];const client={rpc(name,args){return {abortSignal(signal){return new Promise((resolve,reject)=>calls.push({name,args,signal,resolve,reject}));}}}};
 const controller=api.createRequest(client,'get_overview_filters_v1','p_filters',api.validateFacets);
 const slow=controller.load({coords:['A']}),fast=controller.load({coords:['B','C']});assert.equal(calls[0].signal.aborted,true);assert.deepEqual(calls[1].args.p_filters,{coords:['B','C']});
 calls[1].resolve({data:payload()});assert.deepEqual(await fast,payload());calls[0].reject(new Error('late'));assert.equal(await slow,null);
 const cancelled=controller.load({});controller.cancel();calls[2].resolve({data:payload()});assert.equal(await cancelled,null);
 const failed=controller.load({});calls[3].resolve({error:new Error('offline')});await assert.rejects(failed,/offline/);
 const retry=controller.load({});calls[4].resolve({data:payload()});assert.deepEqual(await retry,payload());
});
class Element{
 constructor(tag,doc){this.tagName=tag;this.doc=doc;this.children=[];this.dataset={};this.scrollTop=0;this.textContent='';this.parentElement=null;}
 append(...items){for(const item of items){if(item.tagName==='#fragment')this.append(...item.children);else{item.parentElement=this;this.children.push(item);}}}
 replaceChildren(...items){this.children=[];this.append(...items);}
 querySelectorAll(tag){return this.children.flatMap(c=>[...(c.tagName===tag?[c]:[]),...c.querySelectorAll(tag)]);}
 focus(){this.doc.activeElement=this;}
}
test('DOM keeps focus, selections, ALL checkbox, container listeners and safe labels',()=>{
 const nodes=new Map();const doc={activeElement:null,getElementById:id=>nodes.get(id),createElement:tag=>new Element(tag,doc),createDocumentFragment:()=>new Element('#fragment',doc)};
 nodes.set('list',new Element('div',doc));nodes.set('label',new Element('span',doc));
 const defs=[{key:'sellers',dropdown:'list',text:'label',label:'Todos',selected:new Set(['10','20'])}];const facets={...payload(),sellers:[{code:'10',label:'Vendedor A'},{code:'20',label:'<img onerror=alert(1)>'}]};
 api.render(doc,defs,facets);const container=nodes.get('list');assert.equal(container.querySelectorAll('input').filter(i=>i.checked).length,3);assert.equal(nodes.get('label').textContent,'2 selecionados');
 container.querySelectorAll('input').find(i=>i.value==='10').focus();container.scrollTop=43;
 api.render(doc,defs,facets,facets);assert.equal(nodes.get('list'),container);assert.equal(doc.activeElement.value,'10');assert.equal(container.scrollTop,43);assert.equal(container.querySelectorAll('input').length,3);assert.equal(container.querySelectorAll('img').length,0);
 defs[0].selected.clear();api.render(doc,defs,facets);assert.equal(container.querySelectorAll('input').filter(i=>i.checked).length,0);assert.equal(nodes.get('label').textContent,'Todos');
});

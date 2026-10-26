(function(root) {
    'use strict';
    const keys=['coords','cocoords','promotors','supervisors','sellers','suppliers','types','redes'];
    function validateFacets(data) {
        if (!data || data.schema_version!==1 || keys.some(k=>!Array.isArray(data[k]) || data[k].some(o=>!o || typeof o.code!=='string' || typeof o.label!=='string') || new Set(data[k].map(o=>o.code)).size!==data[k].length)) throw new Error('Opções de filtros inválidas.');
        return data;
    }
    function validateClients(data) {
        if (!Array.isArray(data) || data.length>10 || data.some(c=>!c || ['code','name','city','doc'].some(k=>typeof c[k]!=='string') || (c.promotor!==null && typeof c.promotor!=='string'))) throw new Error('Clientes inválidos.');
        return data;
    }
    function createRequest(client,name,param,validate) {
        let sequence=0,controller;
        return {
            cancel(){sequence++;controller?.abort();},
            async load(value){
                const id=++sequence; controller?.abort(); controller=new AbortController();
                try {
                    const {data,error}=await client.rpc(name,{[param]:value}).abortSignal(controller.signal);
                    if(id!==sequence) return null;
                    if(error) throw error;
                    return validate(data);
                } catch(error){if(id!==sequence)return null;throw error;}
            }
        };
    }
    function optionsWithSelections(options,selected,previous=[]) {
        const result=options.slice();
        // Never silently broaden the query by discarding a selected option.
        for(const code of selected) if(!result.some(o=>o.code===code)) result.push(previous.find(o=>o.code===code)||{code,label:code});
        return result;
    }
    function render(document,definitions,facets,previous={}) {
        if(!facets)return;
        for(const def of definitions){
            const selected=new Set(def.selected);
            const options=facets[def.key].slice();
            options.sort((a,b)=>def.key==='types'?a.code.localeCompare(b.code,'pt-BR',{numeric:true}):a.label.localeCompare(b.label,'pt-BR'));
            const dd=document.getElementById(def.dropdown),text=document.getElementById(def.text);
            if(dd){
                const focused=document.activeElement?.parentElement?.parentElement===dd?document.activeElement.value:null;
                const scroll=dd.scrollTop,fragment=document.createDocumentFragment();
                const add=(o,all=false)=>{
                    const label=document.createElement('label');label.className='flex items-center gap-2 p-2 hover:bg-slate-700 rounded cursor-pointer';
                    const input=document.createElement('input');input.type='checkbox';input.value=o.code;input.dataset.filterType='main';
                    input.className='form-checkbox h-4 w-4 bg-slate-700 border-slate-600 rounded text-teal-500 focus-visible:ring-2 focus-visible:ring-[#FF5E00]';
                    input.checked=all?options.length>0&&options.every(opt=>selected.has(opt.code)):selected.has(o.code);
                    const span=document.createElement('span');span.className='text-xs text-slate-300';span.textContent=o.label;
                    label.append(input,span);fragment.append(label);
                };
                if(def.key==='sellers')add({code:'ALL',label:'Selecionar Todos'},true);
                options.forEach(o=>add(o));dd.replaceChildren(fragment);dd.scrollTop=scroll;
                if(focused!==null)Array.from(dd.querySelectorAll('input')).find(i=>i.value===focused)?.focus({preventScroll:true});
            }
            if(text){
                const labels=optionsWithSelections(options,selected,previous[def.key]);
                const allSelected=['types','suppliers'].includes(def.key)&&selected.size===options.length;
                text.textContent=!selected.size||allSelected?def.label:def.key==='redes'?`C/Rede (${selected.size})`:selected.size===1?labels.find(o=>selected.has(o.code)).label:`${selected.size}${def.key==='types'?' tipos':def.key==='suppliers'?' fornecedores':''} selecionados`;
            }
        }
    }
    function setupClientSearch(document,client,inputId,boxId,onSelect) {
        const input=document.getElementById(inputId),box=document.getElementById(boxId);
        if(!input||!box)return ()=>{};
        const request=createRequest(client,'search_overview_clients_v1','p_query',validateClients);
        let timer,generation=0;
        const cancel=()=>{generation++;clearTimeout(timer);request.cancel();box.classList.add('hidden');};
        input.addEventListener('input',()=>{
            cancel();const query=input.value.trim(),id=generation;if(query.length<3)return;
            timer=setTimeout(async()=>{
                try {
                    const rows=await request.load(query);
                    if(!rows||id!==generation||input.value.trim()!==query)return;
                    box.replaceChildren();if(!rows.length)box.textContent='Nenhum cliente encontrado.';
                    for(const row of rows){
                        const button=document.createElement('button');button.type='button';button.className='w-full text-left px-4 py-3 border-b border-slate-700 hover:bg-slate-700 focus:bg-slate-700';
                        const title=document.createElement('div');title.className='text-sm font-bold text-white';title.textContent=`${row.code} ${row.name}`;
                        const detail=document.createElement('div');detail.className='text-xs text-slate-400';detail.textContent=`${row.city} • ${row.doc}`;
                        button.append(title,detail);button.addEventListener('click',()=>{cancel();input.value=row.code;onSelect(row);});box.append(button);
                    }
                    box.classList.remove('hidden');
                }catch(error){if(id!==generation)return;box.textContent='Não foi possível buscar clientes. Tente novamente.';box.classList.remove('hidden');}
            },300);
        });
        input.addEventListener('keydown',e=>{if(e.key==='Escape')cancel();else if(e.key==='ArrowDown'&&!box.classList.contains('hidden')){e.preventDefault();box.querySelector('button')?.focus();}});
        document.addEventListener('click',e=>{if(!input.contains(e.target)&&!box.contains(e.target))cancel();});
        return cancel;
    }
    const api={validateFacets,validateClients,createRequest,optionsWithSelections,render,setupClientSearch};
    if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PrimeOverviewFiltersRPC=api;
})(typeof window==='undefined'?globalThis:window);

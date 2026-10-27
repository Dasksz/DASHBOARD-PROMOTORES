const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const source = fs.readFileSync(path.join(__dirname, '../js/app/app.js'), 'utf8').replace(/\r\n/g, '\n');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
function section(start, end) { return source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start))); }
(async () => {
  const browser = await chromium.launch({channel:'msedge', headless:true});
  try {
    const page = await browser.newPage();
    await page.setContent(html.slice(html.indexOf('<div id="modal-relatorio"'), html.indexOf('<!-- MODAL DE ACOES DA VISITA')) + '<button id="btn-acao-checkout"></button><button id="btn-acao-checkin"></button><div id="modal-acoes-visita"></div>');
    const result = await page.evaluate(async ({compress, survey, open, checkout, submit, input, checkin}) => {
      const assertions = [];
      function check(value, name) { if (!value) throw Error(name); assertions.push(name); }
      const answers = {estado_gondola:'Boa',tipo_rack:'Nenhum',tem_secao:'Sim',tem_checkout:'Nao',tem_correlatos_bebidas:'Nao',tem_correlatos_molho:'Nao',tem_correlatos_biscoito:'Nao',tem_ilha:'Nao',tem_ponto_extra:'Nao'};
      let current = {respostas:{is_off_route:true},observacao:null};
      let previous = {respostas:{...answers, fotos:[{url:'old-photo',tipo:'geral'}]}, observacao:'Observação anterior'};
      let updateCount=0, uploads=0, uploadFails=false;
      window.showToast = (_, message) => window.lastToast = message;
      window.visitaFotosState = {modo:'geral',fotos:{geral:[],antes:[],depois:[]},max:{geral:4,antes:2,depois:2}};
      window.supabaseClient = {from() {
        let byId=false, pendingUpdate;
        const q={select(){return q;},eq(key){if(key==='id')byId=true;return q;},in(){return q;},neq(){return q;},order(){return q;},limit(){return q;},
          single:async()=>({data:current,error:null}),maybeSingle:async()=>({data:previous,error:null}),
          insert(value){current={...value,id:43};return q;},update(value){pendingUpdate=value;return q;},then(resolve){if(pendingUpdate){updateCount++;current={...current,...pendingUpdate};}return Promise.resolve({data:current,error:null}).then(resolve);}};
        // PostgREST single returns the updated row too.
        q.single=async()=>{if(pendingUpdate){updateCount++;current={...current,...pendingUpdate};}return {data:{...current,id:current.id||42},error:null};};return q;
      },auth:{getUser:async()=>({data:{user:{id:'test-user'}}})},storage:{from(){return {upload:async()=>{uploads++;return {error:uploadFails?{message:'upload failed'}:null};},getPublicUrl:()=>({data:{publicUrl:'https://dldsocponbjthqxhmttj.supabase.co/storage/v1/object/public/visitas-images/test.jpg'}})};}}};
      const normalizeKey = String;
      let currentActionClientCode = null, currentActionClientName = 'Teste';
      let isRoteiroMode = false;
      let myMonthVisits = new Map();
      function renderRoteiroView() {}
      function openActionModal() {}
      function resetRackMultiSelect(value='') {document.getElementById('tipo_rack_hidden').value=value;}
      function resetCustomFileInput() {for(const k of ['geral','antes','depois'])window.visitaFotosState.fotos[k]=[];}
      // Evaluate the actual application functions with this controlled backend.
      const code = survey + '\nvisitaAbertaId=42;clienteEmVisitaId="999999";\n' + compress + input + open + checkout + checkin + submit;
      return await eval('(async()=>{'+code+`
        check(!hasVisitSurvey({is_off_route:true}), 'route metadata is not a survey');
        check(hasVisitSurvey(answers), 'all survey answers recognized');
        await abrirPesquisa();
        check(document.getElementById('visita-atual-id').value==='42', 'visit id survives form reset');
        check(document.getElementById('estado_gondola').value==='Boa', 'previous answers prefilled');
        check(savedVisitPhotos.length===0, 'previous visit photos are not reused');
        await fazerCheckOut();
        check(updateCount===0, 'checkout blocked without current survey');
        const form=document.getElementById('form-visita');
        form.requestSubmit();await new Promise(r=>setTimeout(r,20));
        check(updateCount===0 && lastToast.includes('pelo menos uma foto'), 'observation requires photo');
        form.elements.namedItem('observacoes').value='   ';
        form.requestSubmit();await new Promise(r=>setTimeout(r,20));
        check(updateCount===1 && current.respostas.estado_gondola==='Boa', 'survey saves without photos or observation');
        check(current.respostas.is_off_route===true, 'route metadata preserved');
        check(hasVisitSurvey(current.respostas), 'saved current survey unlocks checkout');
        const canvas=document.createElement('canvas');canvas.width=3000;canvas.height=4000;
        const ctx=canvas.getContext('2d');const pixels=ctx.createImageData(3000,4000);
        crypto.getRandomValues(pixels.data.subarray(0,65536));
        for(let i=65536;i<pixels.data.length;i++)pixels.data[i]=pixels.data[i%65536];
        ctx.putImageData(pixels,0,0);
        const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));
        const photo=await compressImage(new File([blob],'camera.png',{type:'image/png'}));
        const bitmap=await createImageBitmap(photo);
        check(photo.type==='image/jpeg' && photo.size<=250*1024, 'real image compressed to at most 250 KB');
        check(Math.max(bitmap.width,bitmap.height)<=1280 && bitmap.height>bitmap.width, 'portrait aspect ratio and dimension limit preserved');
        let rejected=false;try{await compressImage(new File(['bad'],'bad.jpg',{type:'image/jpeg'}));}catch(e){rejected=true;}
        check(rejected, 'unreadable image rejected instead of uploading original');
        form.elements.namedItem('observacoes').value='Observação com foto';
        window.visitaFotosState.fotos.geral=[photo];uploadFails=true;
        form.requestSubmit();await new Promise(r=>setTimeout(r,20));
        check(updateCount===1, 'failed photo upload blocks survey save');
        uploadFails=false;form.requestSubmit();await new Promise(r=>setTimeout(r,20));
        check(updateCount===2 && current.respostas.fotos.length===1, 'observation saves with uploaded photo');
        const savedUpdates=updateCount;await abrirPesquisa();
        check(savedVisitPhotos.length===1 && window.visitaFotosState.fotos.geral.length===0, 'reopening keeps saved evidence and clears selected files');
        form.requestSubmit();await new Promise(r=>setTimeout(r,20));
        check(updateCount===savedUpdates+1 && uploads===2, 'editing saved survey does not reupload evidence');
        initCustomFileInput();
        await document.getElementById('input-foto-geral').onchange({target:{files:[photo,photo,photo,photo,photo],value:''}});
        check(window.visitaFotosState.fotos.geral.length + savedVisitPhotos.length===4, 'general photos stop at four including saved evidence');
        window.visitaFotosState.modo='antes-depois';
        await document.getElementById('input-foto-antes').onchange({target:{files:[photo,photo,photo],value:''}});
        await document.getElementById('input-foto-depois').onchange({target:{files:[photo,photo,photo],value:''}});
        check(window.visitaFotosState.fotos.antes.length===2 && window.visitaFotosState.fotos.depois.length===2, 'third before and after files are refused by actual input handlers');
        Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition(resolve){resolve({coords:{latitude:0,longitude:0,accuracy:1}});}}});
        const beforeCheckout=updateCount;await fazerCheckOut();
        check(updateCount===beforeCheckout+1 && visitaAbertaId===null, 'checkout succeeds after current survey is saved');
        document.getElementById('modal-relatorio').classList.add('hidden');
        currentActionClientCode='999999';await fazerCheckIn('999999');await new Promise(r=>setTimeout(r,20));
        check(visitaAbertaId===43 && !document.getElementById('modal-relatorio').classList.contains('hidden'), 'successful check-in opens survey automatically');
        return {assertions,compressedBytes:photo.size,dimensions:[bitmap.width,bitmap.height]};
      })()`);
    }, {
      compress:section('    async function compressImage(file)', '    function initCustomFileInput()'),
      input:section('    function initCustomFileInput()', '    function resetCustomFileInput()'),
      survey:section('    const VISIT_SURVEY_FIELDS', '    let clienteEmVisitaId')+'\nlet clienteEmVisitaId;\n',
      open:section('    async function abrirPesquisa()', '    // --- Navigation Helpers ---'),
      checkout:section('    async function fazerCheckOut()', '    async function abrirPesquisa()'),
      checkin:section('    async function fazerCheckIn(clientCode)', '    // --- GEO UPDATE LOGIC ---'),
      submit:section('    // Bind Form Submit','    function renderWeeklyComparisonAmChart(')
    });
    assert.equal(result.assertions.length,21);
    console.log(JSON.stringify(result,null,2));
    assert.match(html,/antes: 2,\s+depois: 2/);
    assert.ok(html.includes('geral: 4,') && html.includes('Geral (até 4)') && html.includes('(0/4)'));
    assert.ok(!html.includes('Fotos compactadas automaticamente'));
    assert.ok(!html.includes('Obrigatório 1 foto'));
    assert.ok(source.includes('await abrirPesquisa();\n\n        }, (err)'));
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});

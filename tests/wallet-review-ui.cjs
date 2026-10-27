const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const nav=html.slice(html.indexOf('<nav id="top-navbar"'),html.indexOf('</nav>')+6).replace('justify-between hidden','justify-between');
  const wallet=html.slice(html.indexOf('    <div id="wallet-view"'),html.indexOf('    <!-- STOCK VIEW -->')).replace('class="hidden container','class="container');
  await page.setContent('<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-black text-slate-300">'+nav+'<div style="padding-top:80px">'+wallet+'</div></body></html>');
  await page.addStyleTag({content:fs.readFileSync(path.join(root,'css/styles.css'),'utf8')});
  await page.addScriptTag({content:fs.readFileSync(path.join(root,'js/app/wallet-review.js'),'utf8')});
  await page.evaluate(()=>{
   window.restores=0;window.failReviews=false;window.confirm=()=>true;window.showToast=()=>{};
   window.samples=[
    {id:'a',client_code:'91001',promoter_code:'promotor2',status:'pending',removed_at:'2026-10-27T12:00:00Z',itinerary_frequency:'weekly',itinerary_days:'1,3,5',client_snapshot:{nomecliente:'Cliente de exemplo — ausente',cidade:'Cidade de exemplo'},hierarchy_snapshot:{nome_promotor:'Promotor de exemplo'},can_review:true,can_restore:false,client_returned:false},
    {id:'b',client_code:'91002',promoter_code:'promotor2',status:'pending',removed_at:'2026-10-27T12:00:00Z',itinerary_frequency:'weekly',itinerary_days:'2,4',client_snapshot:{nomecliente:'Cliente que voltou ao cadastro'},hierarchy_snapshot:{nome_promotor:'Promotor de exemplo'},can_review:true,can_restore:true,client_returned:true}
   ];
   const client={rpc:async(name,args)=>{
    if(window.failReviews)return {error:{message:'simulated network failure'}};
    if(name==='review_removed_client_promoter_v1'){
     const row=samples.find(row=>row.id===args.p_id);row.status=args.p_action;row.reviewed_at=new Date().toISOString();row.review_note=args.p_note;
     return {data:{status:row.status}};
    }
    const matches=samples.filter(row=>(args.p_history||row.status==='pending')&&(!args.p_promoter||row.promoter_code===args.p_promoter));
    return {data:{pending_count:samples.filter(row=>row.status==='pending').length,total:matches.length,items:matches.slice(args.p_offset||0,(args.p_offset||0)+(args.p_limit||50))}};
   }};
   PrimeWalletReview.init({client,onRestored:()=>window.restores++});
  });
  await page.waitForFunction(()=>document.getElementById('user-wallet-review-badge').textContent==='2');
  await page.locator('#wallet-review-section > summary').click();
  await page.waitForFunction(()=>document.querySelectorAll('.wallet-review-card').length===2);
  assert.equal(await page.locator('.wallet-review-card').first().getByText('Restaurar vínculo',{exact:true}).isDisabled(),true);
  assert.equal(await page.locator('.wallet-review-card').nth(1).getByText('Restaurar vínculo',{exact:true}).isEnabled(),true);
  for(const width of [360,390,430,1366]){
   await page.setViewportSize({width,height:900});
   assert.equal(await page.evaluate(()=>innerWidth),width,'mobile viewport must match device width');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal overflow at '+width);
  }
  await page.setViewportSize({width:390,height:844});
  await page.locator('#top-navbar').evaluate(n=>n.style.visibility='hidden');
  await page.locator('#wallet-review-section').screenshot({path:path.join(root,'../../outputs/gestao-carteira-pendencias.png')});
  await page.locator('#top-navbar').evaluate(n=>n.style.visibility='visible');
  await page.locator('.wallet-review-card').first().getByText('Confirmar retirada',{exact:true}).click();
  await page.waitForFunction(()=>document.getElementById('user-wallet-review-badge').textContent==='1');
  assert.equal(await page.locator('.wallet-review-card').count(),1);
  await page.locator('#wallet-review-history').check();
  await page.waitForFunction(()=>document.querySelectorAll('.wallet-review-card').length===2);
  assert.ok(await page.locator('#wallet-review-list').innerText().then(s=>s.includes('Retirada confirmada')));
  await page.locator('.wallet-review-card').nth(1).getByText('Restaurar vínculo',{exact:true}).click();
  await page.waitForFunction(()=>window.restores===1);
  assert.equal(await page.locator('#user-wallet-review-badge').evaluate(n=>n.classList.contains('hidden')),true);
  await page.evaluate(()=>{samples=Array.from({length:56},(_,i)=>({id:'p'+i,client_code:String(i),promoter_code:'promotor2',status:'pending',removed_at:new Date().toISOString(),client_snapshot:{nomecliente:'<img src=x onerror=alert(1)>'},hierarchy_snapshot:{},can_review:false}));return PrimeWalletReview.refresh();});
  assert.equal(await page.locator('.wallet-review-card').count(),50);
  assert.equal(await page.locator('#wallet-review-list img').count(),0,'customer names must remain plain text');
  await page.locator('#wallet-review-next').click();await page.waitForFunction(()=>document.querySelectorAll('.wallet-review-card').length===6);
  await page.evaluate(()=>PrimeWalletReview.setPromoter('other'));
  await page.waitForFunction(()=>document.querySelectorAll('.wallet-review-card').length===0);
  assert.ok(await page.locator('#wallet-review-message').innerText().then(s=>s.includes('deste promotor')));
  await page.evaluate(()=>{failReviews=true;return PrimeWalletReview.refresh();});
  assert.ok(await page.locator('#wallet-review-message').innerText().then(s=>s.includes('Não foi possível')));
  console.log('Wallet UI passed: profile/menu badges, mobile/desktop layout, review/restore, history, pagination, promoter filter, safe text and failure feedback.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

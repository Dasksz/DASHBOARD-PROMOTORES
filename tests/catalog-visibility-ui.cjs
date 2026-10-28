const fs=require('node:fs');
const assert=require('node:assert/strict');
const {chromium}=require('C:/Users/Oseias/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const source=fs.readFileSync('js/app/app.js','utf8');
const renderer=source.slice(source.indexOf('    window.renderProductView = function()'),source.indexOf('    // --- VISITAS LOGIC ---'));
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
  for(const viewport of [{width:390,height:844},{width:1440,height:900}]) {
   const page=await browser.newPage({viewport});
   await page.setContent('<input id="produtos-search"><div id="produtos-count"></div><div id="produtos-list-container"></div>');
   await page.addScriptTag({path:'js/app/catalog-visibility.js'});
   await page.evaluate(()=>{
    window.embeddedData={metadata:[{key:'non_merchandise_codes',value:'["1443","6311"]'}],products:[{code:'1443',descricao:'PALETE DE MADEIRA'},{code:'6311',descricao:'RACK BOTADEIRO'},{code:'137',descricao:'MANIX AMENDOIM SEM PELE 40G'}]};
    window.PrimeCatalogVisibility.apply(window.embeddedData);
    window.escapeHtml=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
   });
   await page.addScriptTag({content:'const embeddedData=window.embeddedData;const stockData05=new Map();const stockData08=new Map();const STORAGE_PRODUTOS_URL="https://example.invalid/";'+renderer});
   await page.evaluate(()=>window.renderProductView());
   assert.equal(await page.locator('#produtos-count').textContent(),'1 Produtos');
   assert.match(await page.locator('#produtos-list-container').textContent(),/MANIX AMENDOIM/);
   await page.locator('#produtos-search').fill('RACK');
   assert.equal(await page.locator('#produtos-list-container').textContent(),'');
   await page.locator('#produtos-search').fill('137');
   assert.match(await page.locator('#produtos-list-container').textContent(),/MANIX AMENDOIM/);
   await page.close();
  }
  console.log('Product catalog UI passed on mobile and desktop: support items hidden; normal products searchable.');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

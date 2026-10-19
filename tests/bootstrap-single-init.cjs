const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const init=fs.readFileSync('js/init.js','utf8');const app=fs.readFileSync('js/app/app.js','utf8');
test('concurrent auth notifications await one dashboard load',async()=>{
 const start=init.indexOf('        let isCheckingProfile = false;');const end=init.indexOf('// Visibility Change Listener',start);assert.ok(start>0&&end>start);
 let loads=0,release;const window={};const element={classList:{add(){},remove(){}},textContent:''};
 const context=vm.createContext({window,document:{getElementById:()=>element},console,Promise,setTimeout:()=>0,telaLogin:element,telaPendente:element,telaLoading:element,supabaseClient:{from:()=>({select:()=>({eq:()=>({single:async()=>({data:{status:'aprovado',role:'adm',name:'Admin'}})})})})},carregarDadosDoSupabase:()=>{loads++;return new Promise(r=>release=()=>{window.isDataLoaded=true;r();});}});
 vm.runInContext(init.slice(start,end),context);
 const session={user:{id:'admin',user_metadata:{},email:'a'}};
 context.session=session;const first=vm.runInContext('verifyUserProfile(session)',context);await new Promise(r=>setImmediate(r));
 assert.equal(loads,1);await vm.runInContext('verifyUserProfile(session)',context);assert.equal(loads,1);release();await first;await vm.runInContext('verifyUserProfile(session)',context);assert.equal(loads,1);
});
test('a repeated app script returns before installing a second set of handlers',()=>{
 const head=app.slice(0,app.indexOf('        const embeddedData'));
 const context=vm.createContext({window:{},installs:0});const run=head+'installs++;})();';vm.runInContext(run,context);vm.runInContext(run,context);assert.equal(context.installs,1);
});

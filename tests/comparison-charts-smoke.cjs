const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../js/app/app.js'),'utf8');
const el=()=>({textContent:'',classList:{toggle(){}}});const calls=[];
const data={charts:{daily:{labels:[1,3],current:[10,2],history:[5,null]},weekly:[{label:'Semana 1',current:12,history:5}],monthly:[{month_date:'2026-09-01',fat:15,clients:2},{month_date:'2026-10-01',fat:12,clients:1}]}};
const ctx={Date,Array,String,comparisonChartType:'daily',comparisonMonthlyMetric:'faturamento',useTendencyComparison:false,charts:{},document:{getElementById:el},weeklyComparisonChartContainer:el(),monthlyComparisonChartContainer:el(),comparisonChartTitle:el(),dashboardRpcState:{comparison:{data}},renderWeeklyComparisonAmChart:(...v)=>calls.push(v),renderMonthlyComparisonAmChart:(...v)=>calls.push(v)};
vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('        function renderComparisonRpcCharts('),source.indexOf('        function resetComparisonFilters()')),ctx);
for(const tendency of [false,true])for(const type of ['daily','weekly','monthly']){ctx.useTendencyComparison=tendency;ctx.comparisonChartType=type;ctx.renderComparisonRpcCharts();}
assert.equal(calls.length,6);assert.deepEqual(calls[0][1],[10,2]);assert.deepEqual(calls[0][2],[5,null]);assert.deepEqual(calls[3][1],[10,2]);assert.deepEqual(calls[4][1],[12]);assert.deepEqual(calls[2][1],[15,12]);
ctx.comparisonMonthlyMetric='clientes';ctx.renderComparisonRpcCharts();assert.deepEqual(calls.at(-1)[1],[2,1]);
console.log('Gráficos diário/semanal/mensal preservam valores RPC, null e alternância faturamento/clientes: OK');

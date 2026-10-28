const {test}=require('node:test');
const assert=require('node:assert/strict');
const {apply}=require('../js/app/catalog-visibility.js');
test('support items are hidden from all product sources and sales projections',()=>{
 const originalHistory={columns:['PRODUTO','VALOR'],values:{PRODUTO:['1443','137'],VALOR:[0,20]},length:2};
 const data={metadata:[{key:'non_merchandise_codes',value:'["1443"]'}],products:[{code:'1443'},{code:'137'}],
 dim_produtos:[{codigo:'1443'},{codigo:'137'}],activeProductCodes:['1443','137'],productDetails:{1443:{},137:{}},
 stockMap05:{1443:10,137:20},stockMap08:{1443:2},detailed:[{PRODUTO:'1443'},{PRODUTO:'137'}],history:originalHistory,
 innovationsMonth:[{codigo:'1443'},{codigo:'137'}]};
 apply(data);
 assert.deepEqual(data.products,[{code:'137'}]);assert.deepEqual(data.dim_produtos,[{codigo:'137'}]);
 assert.deepEqual(data.activeProductCodes,['137']);assert.deepEqual(Object.keys(data.productDetails),['137']);
 assert.deepEqual(data.stockMap05,{'137':20});assert.deepEqual(data.stockMap08,{});
 assert.deepEqual(data.detailed,[{PRODUTO:'137'}]);assert.deepEqual(data.history.values,{PRODUTO:['137'],VALOR:[20]});
 assert.equal(data.history.length,1);assert.equal(originalHistory.length,2);
 assert.deepEqual(data.innovationsMonth,[{codigo:'137'}]);
});
test('missing support classification preserves normal data',()=>{
 const data={products:[{code:'137'}]};assert.equal(apply(data),data);assert.deepEqual(data.products,[{code:'137'}]);
});

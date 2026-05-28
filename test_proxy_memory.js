const fs = require('fs');
const utilsCode = fs.readFileSync('js/app/utils.js', 'utf8');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
eval(utilsCode);

const ColumnarDataset = window.ColumnarDataset;
const numRows = 300000;
const columnarData = {
    columns: ['CODCLI', 'NOME', 'SUPERV', 'QTVENDA', 'VLVENDA'],
    values: {
        'CODCLI': new Int32Array(numRows),
        'NOME': new Array(numRows).fill('CLIENT NAME'),
        'SUPERV': new Int32Array(numRows),
        'QTVENDA': new Float64Array(numRows),
        'VLVENDA': new Float64Array(numRows),
    },
    length: numRows
};

for(let i=0; i<numRows; i++) {
    columnarData.values['CODCLI'][i] = i;
    columnarData.values['SUPERV'][i] = i % 10;
    columnarData.values['QTVENDA'][i] = Math.random() * 100;
    columnarData.values['VLVENDA'][i] = Math.random() * 1000;
}

const dataset = new ColumnarDataset(columnarData);

function test() {
    global.gc();
    console.log("Memory before get(i):", process.memoryUsage().heapUsed / 1024 / 1024, "MB");
    const arr = [];
    for(let i=0; i<dataset.length; i++) {
        // This simulates caching dataset elements into an array when `.filter()` or `.map()` is called
        // Note: dataset.get(i) returns a NEW proxy object every time!
        arr.push(dataset.get(i));
    }
    console.log("Memory after caching proxies:", process.memoryUsage().heapUsed / 1024 / 1024, "MB");
}

test();

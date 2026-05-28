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

function testFilter() {
    console.log("Memory before filter:", process.memoryUsage().heapUsed / 1024 / 1024, "MB");
    const start = Date.now();
    let count = 0;
    // Simulate typical filter that creates an array
    const result = dataset.filter(row => {
        return row.SUPERV === 1; // triggers Proxy trap
    });
    console.log("Filter time:", Date.now() - start, "ms");
    console.log("Result length:", result.length);
    console.log("Memory after filter:", process.memoryUsage().heapUsed / 1024 / 1024, "MB");
}

testFilter();

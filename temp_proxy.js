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

function testDirectIter() {
    console.log("Memory before direct:", process.memoryUsage().heapUsed / 1024 / 1024, "MB");
    const start = Date.now();
    let count = 0;

    // Instead of Proxy, read directly from raw arrays
    const supervArray = dataset._data['SUPERV'];
    for(let i=0; i<dataset.length; i++) {
        if (supervArray[i] === 1) {
            count++;
        }
    }

    console.log("Direct time:", Date.now() - start, "ms");
    console.log("Result length:", count);
    console.log("Memory after direct:", process.memoryUsage().heapUsed / 1024 / 1024, "MB");
}

testDirectIter();

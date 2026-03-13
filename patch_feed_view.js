const fs = require('fs');
const content = fs.readFileSync('js/app/feed_view.js', 'utf8');

const targetStr = `
                        const checkSales = (salesArray) => {
                            if (!salesArray || !Array.isArray(salesArray)) return;
                            for (let i = 0; i < salesArray.length; i++) {
                                const s = salesArray[i];`;

const replaceStr = `
                        const checkSales = (salesArray) => {
                            if (!salesArray || typeof salesArray.length !== 'number') return;
                            const isCol = salesArray && typeof salesArray.get === 'function'; // Suporte para ColumnarDataset
                            for (let i = 0; i < salesArray.length; i++) {
                                const s = isCol ? salesArray.get(i) : salesArray[i];`;

const newContent = content.replace(targetStr, replaceStr);
fs.writeFileSync('js/app/feed_view.js', newContent);
console.log('Patch aplicado com sucesso!');

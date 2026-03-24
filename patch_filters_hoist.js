const fs = require('fs');
let content = fs.readFileSync('js/app/app.js', 'utf8');

// The Sets should be hoisted so they aren't recreated on EVERY call
content = content.replace(
    /        function updateTipoVendaFilter\(dropdown, filterText, selectedArray, dataSource, skipRender = false\) \{\s+if \(!dropdown \|\| !filterText\) return selectedArray;\s+\/\/ Collect unique types from data source\s+const forbiddenTiposVenda = new Set\(\['TIPOVENDA', 'TIPO VENDA', 'TIPO', 'CODUSUR', 'CODCLI', 'SUPERV', 'NOME'\]\);/,
    `        const forbiddenTiposVenda = new Set(['TIPOVENDA', 'TIPO VENDA', 'TIPO', 'CODUSUR', 'CODCLI', 'SUPERV', 'NOME']);\n        function updateTipoVendaFilter(dropdown, filterText, selectedArray, dataSource, skipRender = false) {\n            if (!dropdown || !filterText) return selectedArray;\n            // Collect unique types from data source`
);

content = content.replace(
    /        function updateRedeFilter\(dropdown, buttonTextElement, selectedArray, dataSource, baseText = 'C\/Rede'\) \{\s+if \(!dropdown \|\| !buttonTextElement\) return selectedArray;\s+const forbiddenRedes = new Set\(\['RAMO', 'RAMO DE ATIVIDADE', 'RAMO_ATIVIDADE', 'DESCRICAO', 'ATIVIDADE'\]\);/,
    `        const forbiddenRedes = new Set(['RAMO', 'RAMO DE ATIVIDADE', 'RAMO_ATIVIDADE', 'DESCRICAO', 'ATIVIDADE']);\n        function updateRedeFilter(dropdown, buttonTextElement, selectedArray, dataSource, baseText = 'C/Rede') {\n            if (!dropdown || !buttonTextElement) return selectedArray;`
);

content = content.replace(
    /        function updateSupplierFilter\(dropdown, filterText, selectedArray, dataSource, filterType = 'comparison', skipRender = false\) \{\s+if \(!dropdown \|\| !filterText\) return selectedArray;\s+const forbiddenSuppliers = new Set\(\['CODFOR', 'FORNECEDOR', 'COD FOR', 'NOME DO FORNECEDOR', 'FORNECEDOR_NOME'\]\);/,
    `        const forbiddenSuppliers = new Set(['CODFOR', 'FORNECEDOR', 'COD FOR', 'NOME DO FORNECEDOR', 'FORNECEDOR_NOME']);\n        function updateSupplierFilter(dropdown, filterText, selectedArray, dataSource, filterType = 'comparison', skipRender = false) {\n            if (!dropdown || !filterText) return selectedArray;`
);

fs.writeFileSync('js/app/app.js', content);
console.log('Filters hoisted.');

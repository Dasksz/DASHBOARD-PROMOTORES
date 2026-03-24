const fs = require('fs');
let content = fs.readFileSync('js/app/app.js', 'utf8');

// 1. updateTipoVendaFilter
content = content.replace(
    /const forbidden = \['TIPOVENDA', 'TIPO VENDA', 'TIPO', 'CODUSUR', 'CODCLI', 'SUPERV', 'NOME'\];\s+const uniqueTypes = dataSource\.reduce\(\(acc, item\) => \{\s+const t = item\.TIPOVENDA;\s+if \(t && !forbidden\.includes\(t\.toUpperCase\(\)\)\) acc\.add\(t\);/,
    `const forbiddenTiposVenda = new Set(['TIPOVENDA', 'TIPO VENDA', 'TIPO', 'CODUSUR', 'CODCLI', 'SUPERV', 'NOME']);\n            const uniqueTypes = dataSource.reduce((acc, item) => {\n                const t = item.TIPOVENDA;\n                if (t && !forbiddenTiposVenda.has(t.toUpperCase())) acc.add(t);`
);

// 2. updateRedeFilter
content = content.replace(
    /const forbidden = \['RAMO', 'RAMO DE ATIVIDADE', 'RAMO_ATIVIDADE', 'DESCRICAO', 'ATIVIDADE'\];\s+const redesToShow = \[\.\.\.dataSource\.reduce\(\(acc, item\) => \{\s+const r = item\.ramo;\s+if \(r && r !== 'N\/A' && !forbidden\.includes\(r\.toUpperCase\(\)\)\) acc\.add\(r\);/,
    `const forbiddenRedes = new Set(['RAMO', 'RAMO DE ATIVIDADE', 'RAMO_ATIVIDADE', 'DESCRICAO', 'ATIVIDADE']);\n            const redesToShow = [...dataSource.reduce((acc, item) => {\n                const r = item.ramo;\n                if (r && r !== 'N/A' && !forbiddenRedes.has(r.toUpperCase())) acc.add(r);`
);

// 3. updateSupplierFilter
content = content.replace(
    /const forbidden = \['CODFOR', 'FORNECEDOR', 'COD FOR', 'NOME DO FORNECEDOR', 'FORNECEDOR_NOME'\];\s+const suppliers = new Map\(\);\s+dataSource\.forEach\(s => \{\s+const codFor = s\.CODFOR;\s+if \(codFor && !forbidden\.includes\(String\(codFor\)\.toUpperCase\(\)\)\) \{/,
    `const forbiddenSuppliers = new Set(['CODFOR', 'FORNECEDOR', 'COD FOR', 'NOME DO FORNECEDOR', 'FORNECEDOR_NOME']);\n            const suppliers = new Map();\n            dataSource.forEach(s => {\n                const codFor = s.CODFOR;\n                if (codFor && !forbiddenSuppliers.has(String(codFor).toUpperCase())) {`
);

fs.writeFileSync('js/app/app.js', content);
console.log('Filters optimized.');

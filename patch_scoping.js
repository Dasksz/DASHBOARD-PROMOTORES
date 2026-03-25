const fs = require('fs');
const filePath = 'js/app/app.js';
let content = fs.readFileSync(filePath, 'utf8');

const regex = /if \(window\.globalClientGoals\) \{\s*goalClients\.forEach\(c => \{/g;
const replacement = `let radarGoalClients = getHierarchyFilteredClients('main', allClientsData);
                if (typeof adminViewMode !== 'undefined' && adminViewMode === 'seller' && selectedSupervisors.size > 0) {
                    radarGoalClients = radarGoalClients.filter(c => {
                        const rca = String(c.rca1 || '').trim();
                        const details = sellerDetailsMap.get(rca);
                        return details && selectedSupervisors.has(details.supervisor);
                    });
                }
                if (selectedVendedores.size > 0) {
                    radarGoalClients = radarGoalClients.filter(c => selectedVendedores.has(String(c.rca1 || '').trim()));
                }
                if (clientCodesInRede) {
                     radarGoalClients = radarGoalClients.filter(c => clientCodesInRede.has(c['Código']));
                }
                if (codcli) {
                     const searchKey = normalizeKey(codcli);
                     radarGoalClients = radarGoalClients.filter(c => normalizeKey(String(c['Código'] || c['codigo_cliente'])) === searchKey);
                }

                if (window.globalClientGoals) {
                    radarGoalClients.forEach(c => {`;

if (regex.test(content)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Successfully patched scoping for Share por Categoria goal calculation.');
} else {
    console.error('Regex did not match. Check the source file.');
}

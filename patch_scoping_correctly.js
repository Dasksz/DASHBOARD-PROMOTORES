const fs = require('fs');
const filePath = 'js/app/app.js';
let content = fs.readFileSync(filePath, 'utf8');

const targetStr = `const visibleClientsForGoals = getHierarchyFilteredClients('main', allClientsData);
                if (window.globalClientGoals) {
                    visibleClientsForGoals.forEach(c => {`;

const replacementStr = `let radarGoalClients = getHierarchyFilteredClients('main', allClientsData);
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

if (content.includes(targetStr)) {
    content = content.replace(targetStr, replacementStr);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Successfully patched scoping.');
} else {
    console.error('Target string not found.');
}

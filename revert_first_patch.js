const fs = require('fs');
const filePath = 'js/app/app.js';
let content = fs.readFileSync(filePath, 'utf8');

const regex = /let radarGoalClients = getHierarchyFilteredClients\('main', allClientsData\);\s*if \(typeof adminViewMode !== 'undefined' && adminViewMode === 'seller' && selectedSupervisors\.size > 0\) \{\s*radarGoalClients = radarGoalClients\.filter\(c => \{\s*const rca = String\(c\.rca1 \|\| ''\)\.trim\(\);\s*const details = sellerDetailsMap\.get\(rca\);\s*return details && selectedSupervisors\.has\(details\.supervisor\);\s*\}\);\s*\}\s*if \(selectedVendedores\.size > 0\) \{\s*radarGoalClients = radarGoalClients\.filter\(c => selectedVendedores\.has\(String\(c\.rca1 \|\| ''\)\.trim\(\)\)\);\s*\}\s*if \(clientCodesInRede\) \{\s*radarGoalClients = radarGoalClients\.filter\(c => clientCodesInRede\.has\(c\['Código'\]\)\);\s*\}\s*if \(codcli\) \{\s*const searchKey = normalizeKey\(codcli\);\s*radarGoalClients = radarGoalClients\.filter\(c => normalizeKey\(String\(c\['Código'\] \|\| c\['codigo_cliente'\]\)\) === searchKey\);\s*\}\s*if \(window\.globalClientGoals\) \{\s*radarGoalClients\.forEach\(c => \{/g;

const replacement = `if (window.globalClientGoals) {
                            goalClients.forEach(c => {`;

// We want to replace the FIRST occurrence only (the one around line 10800 that was a mistake)
const firstIndex = content.search(regex);
if (firstIndex !== -1) {
    const before = content.substring(0, firstIndex);
    const after = content.substring(firstIndex).replace(regex, replacement);
    // wait, I can just replace the first match by not using /g flag!
}

content = content.replace(regex, function(match, offset, string) {
    if (offset < 10900) { // the first one is at 10800, second at 10850
        return replacement;
    }
    return match; // Keep the second one
});

fs.writeFileSync(filePath, content, 'utf8');

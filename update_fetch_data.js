const fs = require('fs');
let code = fs.readFileSync('js/app/feed_view.js', 'utf8');

const regex = /query = query\.range\(from, to\);\s+const role = \(window\.userRole \|\| ''\)\.trim\(\)\.toLowerCase\(\);\s+const hierarchyRole = typeof window\.userHierarchyContext !== 'undefined' && window\.userHierarchyContext \? window\.userHierarchyContext\.role : '';\s+\/\/ Strict mapping based on hierarchy\s+const isPromoter = window\.userIsPromoter \|\|\s+hierarchyRole === 'promotor' \|\|\s+\(typeof window\.optimizedData !== 'undefined' && window\.optimizedData\.promotorMap && window\.optimizedData\.promotorMap\.has\(\(window\.userRole \|\| ''\)\.trim\(\)\.toUpperCase\(\)\)\);\s+const isAdmin = role === 'adm';\s+\/\/ Check hierarchy role for coordinator and co-coordinator\s+const isCoord = \(hierarchyRole === 'coord' \|\| hierarchyRole === 'cocoord'\) && !isPromoter;\s+\/\/ Check global window vars initialized from dataset or hierarchy logic\s+const isSup = window\.userIsSupervisor \|\| hierarchyRole === 'supervisor' \|\| role === 'supervisor';\s+const isSeller = window\.userIsSeller \|\| hierarchyRole === 'vendedor' \|\| hierarchyRole === 'seller';\s+const isManager = isAdmin \|\| isCoord \|\| isSup; \/\/ Defines who can favorite and see all details/g;

const replacement = `query = query.range(from, to);

        const { role, hierarchyRole, isPromoter, isAdmin, isCoord, isSup, isManager } = checkIsManager();
        const isSeller = window.userIsSeller || hierarchyRole === 'vendedor' || hierarchyRole === 'seller';`;

code = code.replace(regex, replacement);

fs.writeFileSync('js/app/feed_view.js', code);

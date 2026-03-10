const fs = require('fs');
let code = fs.readFileSync('js/app/feed_view.js', 'utf8');

// The plan for `feed_view.js` filtering:
// 1. `isManager` becomes `window.userRole === 'adm' || window.userRole === 'coord' || window.userRole === 'cocoord' || window.userIsSupervisor`.
// 2. Wait, what about sellers (`vendedores`)? The user says:
//    "A ideia é que a pesquisa apareça para qualquer um, apenas seguindo o parâmetro da base de cliente cadastrada.... ( isso para vendedores e supervisores )
//    para promotores ainda manteremos a logica atual"
//
// So, for "adm", they see everything.
// For "supervisors", "coords", "cocoords" and "sellers", they should see posts for clients in their wallet.
// The wallet is `window.activeClientCodes`.
//
// Let's rewrite the filtering logic in `feed_view.js` `renderPosts`:
//
// ```javascript
// const isAdmin = role === 'adm';
// const isCoord = role === 'coord' || role === 'cocoord';
// const isSup = window.userIsSupervisor;
// const isSeller = window.userIsSeller;
// const isPromoter = window.userIsPromoter || (!isAdmin && !isCoord && !isSup && !isSeller);
//
// const isManager = isAdmin || isCoord || isSup; // determines if they can favorite? Actually, anyone should be able to see favorites. But only managers can *favorite*?
// // Let's keep `isManager` as `isAdmin || isCoord || isSup`. Wait, what about sellers? The previous SQL allowed coords and adms to favorite. Supervisors were added recently. Sellers probably can't favorite.
// // Let's check `isManager && window.userId` for the favorite button. Yes, sellers shouldn't see the favorite button.
//
// // Filter 1: Only show visits with photos or answers
// if (fotos.length === 0 && respostasCount === 0) return;
//
// // Filter 2: Wallet / Role checks
// if (isAdmin || isCoord) {
//     // Sees everything
// } else if (isSup || isSeller) {
//     // Must belong to their wallet
//     if (window.activeClientCodes && window.activeClientCodes.size > 0) {
//         if (!window.activeClientCodes.has(String(visit.client_code).trim())) {
//             return; // Skip: client not in wallet
//         }
//     } else {
//         return; // Wallet is empty, skip
//     }
// } else {
//     // Promoter logic: own visits OR other visits with both 'antes' and 'depois'
//     if (String(visit.id_promotor) !== String(window.userId)) {
//         const hasAntes = fotos.some(f => f.tipo === 'antes');
//         const hasDepois = fotos.some(f => f.tipo === 'depois');
//         if (!hasAntes || !hasDepois) {
//             return; // Skip
//         }
//     }
// }
// ```

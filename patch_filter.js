const fs = require('fs');
let code = fs.readFileSync('js/app/feed_view.js', 'utf8');

// I'll just find the line index and replace lines directly to be foolproof.

const lines = code.split('\n');
const filter1Index = lines.findIndex(l => l.includes('Filter 1: Only show visits with photos or answers'));
const filter2Index = lines.findIndex(l => l.includes('Filter 2: If not manager'));

if (filter1Index !== -1 && filter2Index !== -1) {
    // let's replace from filter2Index up to the card element creation
    const cardIndex = lines.findIndex((l, i) => i > filter2Index && l.includes("const card = document.createElement('div');"));

    if (cardIndex !== -1) {
        const replacement = `
                // Filter 2: Role-based Visibility
                const visitClientCode = String(visit.client_code || '').trim();
                if (isAdmin || isCoord) {
                    // Sees everything
                } else if (isSup || isSeller) {
                    // Must belong to their wallet
                    if (window.activeClientCodes && window.activeClientCodes.size > 0) {
                        if (!window.activeClientCodes.has(visitClientCode)) {
                            return; // Skip: client not in wallet
                        }
                    } else {
                        return; // Wallet is empty, skip
                    }
                } else {
                    // Promoter logic: own visits OR other visits with both 'antes' and 'depois'
                    if (String(visit.id_promotor) !== String(window.userId)) {
                        const hasAntes = fotos.some(f => f.tipo === 'antes');
                        const hasDepois = fotos.some(f => f.tipo === 'depois');
                        if (!hasAntes || !hasDepois) {
                            return; // Skip this visit
                        }
                    }
                }
`;

        lines.splice(filter2Index, cardIndex - filter2Index, replacement);
        fs.writeFileSync('js/app/feed_view.js', lines.join('\n'));
        console.log("Successfully replaced Filter 2 by line indexing");
    } else {
        console.log("Could not find card index");
    }
} else {
    console.log("Could not find filter indices");
}

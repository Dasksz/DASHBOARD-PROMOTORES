const fs = require('fs');

let content = fs.readFileSync('js/app/app_part3.js', 'utf8');

content = content.replace(
`        if (optimizedData && optimizedData.clientPromotersMap) {
             // O(1) Lookup (Old Map)
             const promoData = optimizedData.clientPromotersMap.get(normalizeKey(clientCode));
             if (promoData) {
                 client.itinerary_frequency = promoData.itinerary_frequency;
                 client.itinerary_next_date = promoData.itinerary_ref_date;
             }
        }

`,
`        if (optimizedData && optimizedData.clientPromotersMap) {
             // O(1) Lookup (Old Map)
             const promoData = optimizedData.clientPromotersMap.get(normalizeKey(clientCode));
             if (promoData) {
                 client.itinerary_frequency = promoData.itinerary_frequency;
                 client.itinerary_next_date = promoData.itinerary_ref_date;
             }
        }

`
);
fs.writeFileSync('js/app/app_part3.js', content, 'utf8');

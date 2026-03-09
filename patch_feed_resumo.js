const fs = require('fs');
let code = fs.readFileSync('js/app/feed_view.js', 'utf8');

const regex = /\/\/ Building answers summary \(like Instagram captions\)[\s\S]*?card\.innerHTML = `/;
const newLogic = `// Building answers summary (like Instagram captions)
                let resumoRespostasHtml = '';
                if (respostasObj && typeof respostasObj === 'object') {
                    const chavesOcultas = ['fotos', 'is_off_route', 'observacoes'];
                    let respostasFormatadas = [];
                    for (const [key, value] of Object.entries(respostasObj)) {
                        // Ignorar chaves ocultas e fotos
                        if (chavesOcultas.includes(key) || key.toLowerCase().includes('foto')) continue;

                        // Ignore empty strings
                        if (value === '' || value === null || value === undefined) continue;

                        let label = key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim();
                        // Capitalize each word for label
                        label = label.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

                        let valStr = String(value);
                        if (valStr.toLowerCase() === 'true' || valStr.toLowerCase() === 'sim') {
                            valStr = '<span class="text-green-400">Sim</span>';
                        } else if (valStr.toLowerCase() === 'false' || valStr.toLowerCase() === 'nao' || valStr.toLowerCase() === 'não') {
                            valStr = '<span class="text-red-400">Não</span>';
                        } else {
                            valStr = \`<span class="text-slate-200">\${valStr}</span>\`;
                        }

                        respostasFormatadas.push(\`<div class="flex justify-between items-center py-1 border-b border-slate-700/30 last:border-0"><span class="text-slate-400 text-xs font-medium">\${label}:</span> <span class="text-xs font-semibold">\${valStr}</span></div>\`);
                    }

                    if (respostasFormatadas.length > 0) {
                        resumoRespostasHtml = \`
                            <div class="mt-3 bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                                \${respostasFormatadas.join('')}
                            </div>
                        \`;
                    }
                }

                // Ensure data is cached for the modal
                if (clientInfo && !window.FeedVisitas.clientCache) window.FeedVisitas.clientCache = {};
                if (clientInfo) {
                    window.FeedVisitas.clientCache[visit.id] = clientInfo;
                }

                card.innerHTML = \``;

code = code.replace(regex, newLogic);
fs.writeFileSync('js/app/feed_view.js', code);

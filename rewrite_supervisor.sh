#!/bin/bash
cat << 'INNER_EOF' > /tmp/search.txt
                        // 2. Supervisor (Baseado na venda mais recente do cliente)
                        let mostRecentSale = null;
                        let maxDateValue = -Infinity;

                        const parseSaleDate = (val) => {
                            if (!val) return -Infinity;
                            if (val instanceof Date) return val.getTime();
                            if (typeof val === 'number') {
                                if (val < 1000000) {
                                    // Excel serial date (e.g. 45300) -> Convert to ms timestamp
                                    const ts = Math.round((val - 25569) * 86400 * 1000);
                                    // Add timezone offset so it correctly aligns to UTC boundaries
                                    return ts + new Date(ts).getTimezoneOffset() * 60000;
                                }
                                return val; // Already a timestamp
                            }
                            // Se for uma string do Postgres (ex: '2024-03-06 16:52:00+00'), converte pro ISO correto para não dar erro
                            if (typeof val === 'string') {
                                // Normaliza timestamptz string (ex. substitui o espaco por T e +00 por Z)
                                val = val.replace(' ', 'T').replace('+00', 'Z');
                            }
                            const d = new Date(val);
                            return isNaN(d.getTime()) ? -Infinity : d.getTime();
                        };

                        const checkSales = (salesArray) => {
                            if (!salesArray) return;
                            for (let i = 0; i < salesArray.length; i++) {
                                const s = salesArray[i];
                                // Aceita maiúsculo ou minúsculo robustamente
                                const codCli = s.CODCLI || s.codcli || s.cod_cli || s.COD_CLI;
                                const codSup = s.CODSUPERVISOR || s.codsupervisor || s.cod_supervisor || s.COD_SUPERVISOR;
                                const dtPed = s.DTPED || s.dtped || s.dt_ped || s.DT_PED;

                                if (codCli && String(codCli).trim() === clientCodeForLookup && codSup) {
                                    const dValue = parseSaleDate(dtPed);
                                    if (dValue > maxDateValue) {
                                        maxDateValue = dValue;
                                        mostRecentSale = {
                                            CODSUPERVISOR: codSup // Aqui salva como foi extraido
                                        };
                                    }
                                }
                            }
                        };

                        checkSales(window.allSalesData);
                        checkSales(window.allHistoryData);

                        if (mostRecentSale && mostRecentSale.CODSUPERVISOR) {
                            const codSup = String(mostRecentSale.CODSUPERVISOR).trim();
                            if (window.maps && window.maps.supervisores && window.maps.supervisores.has(codSup)) {
                                nomeSupervisor = window.maps.supervisores.get(codSup);
                            } else if (window.embeddedData && window.embeddedData.dim_supervisores) {
                                // Aceita chave 'codigo' ou 'CODIGO' ou 'codigo_supervisor'
                                const dimSup = window.embeddedData.dim_supervisores.find(s => {
                                    const c = s.codigo || s.CODIGO || s.codigo_supervisor || s.CODIGO_SUPERVISOR;
                                    return c && String(c).trim() === codSup;
                                });
                                // Aceita chave 'nome' ou 'NOME'
                                if (dimSup) {
                                    nomeSupervisor = dimSup.nome || dimSup.NOME || dimSup.nome_supervisor || dimSup.NOME_SUPERVISOR || '-';
                                }
                            }
                        }
INNER_EOF

cat << 'INNER_EOF' > /tmp/replace.txt
                        // 2. Supervisor (Baseado na venda mais recente do cliente)
                        let mostRecentSale = null;
                        let maxDateValue = -Infinity;

                        const parseSaleDate = (val) => {
                            if (!val) return -Infinity;
                            if (val instanceof Date) return val.getTime();
                            if (typeof val === 'number') {
                                if (val < 1000000) {
                                    // Excel serial date (e.g. 45300) -> Convert to ms timestamp
                                    const ts = Math.round((val - 25569) * 86400 * 1000);
                                    return ts + new Date(ts).getTimezoneOffset() * 60000;
                                }
                                return val; // Already a timestamp
                            }
                            if (typeof val === 'string') {
                                // Tenta converter datas do tipo DD/MM/YYYY
                                if (val.includes('/')) {
                                    const parts = val.split('/');
                                    if (parts.length === 3) {
                                        // Assume DD/MM/YYYY
                                        const d = new Date(parts[2], parts[1] - 1, parts[0]);
                                        if (!isNaN(d.getTime())) return d.getTime();
                                    }
                                }
                                val = val.replace(' ', 'T').replace('+00', 'Z');
                            }
                            const d = new Date(val);
                            return isNaN(d.getTime()) ? -Infinity : d.getTime();
                        };

                        const checkSales = (salesArray) => {
                            if (!salesArray || !Array.isArray(salesArray)) return;
                            for (let i = 0; i < salesArray.length; i++) {
                                const s = salesArray[i];
                                if (!s) continue;

                                const codCli = s.CODCLI !== undefined ? s.CODCLI : (s.codcli !== undefined ? s.codcli : (s.cod_cli !== undefined ? s.cod_cli : s.COD_CLI));
                                const codSup = s.CODSUPERVISOR !== undefined ? s.CODSUPERVISOR : (s.codsupervisor !== undefined ? s.codsupervisor : (s.cod_supervisor !== undefined ? s.cod_supervisor : s.COD_SUPERVISOR));
                                const dtPed = s.DTPED !== undefined ? s.DTPED : (s.dtped !== undefined ? s.dtped : (s.dt_ped !== undefined ? s.dt_ped : s.DT_PED));

                                if (codCli !== undefined && codCli !== null && String(codCli).trim() === clientCodeForLookup && codSup !== undefined && codSup !== null && String(codSup).trim() !== '') {
                                    const dValue = parseSaleDate(dtPed);
                                    if (dValue > maxDateValue) {
                                        maxDateValue = dValue;
                                        mostRecentSale = {
                                            CODSUPERVISOR: codSup
                                        };
                                    }
                                }
                            }
                        };

                        checkSales(window.allSalesData);
                        checkSales(window.allHistoryData);

                        if (mostRecentSale && mostRecentSale.CODSUPERVISOR) {
                            const codSup = String(mostRecentSale.CODSUPERVISOR).trim();
                            // 1. Tentar mapeamento do window.maps
                            if (window.maps && window.maps.supervisores && window.maps.supervisores.has(codSup)) {
                                nomeSupervisor = window.maps.supervisores.get(codSup);
                            }
                            // 2. Tentar raw window.embeddedData.dim_supervisores (onde os dados estão disponíveis desde o init)
                            else if (window.embeddedData && window.embeddedData.dim_supervisores && Array.isArray(window.embeddedData.dim_supervisores)) {
                                const dimSup = window.embeddedData.dim_supervisores.find(s => {
                                    const c = s.codigo !== undefined ? s.codigo : (s.CODIGO !== undefined ? s.CODIGO : (s.codigo_supervisor !== undefined ? s.codigo_supervisor : s.CODIGO_SUPERVISOR));
                                    return c !== undefined && c !== null && String(c).trim() === codSup;
                                });
                                if (dimSup) {
                                    nomeSupervisor = dimSup.nome || dimSup.NOME || dimSup.nome_supervisor || dimSup.NOME_SUPERVISOR || '-';
                                }
                            }
                        }
INNER_EOF

ruby -e '
search = File.read("/tmp/search.txt")
replace = File.read("/tmp/replace.txt")
content = File.read("js/app/feed_view.js")
if content.include?(search)
  File.write("js/app/feed_view.js", content.sub(search, replace))
  puts "Successfully replaced."
else
  puts "Search string not found!"
end
'

<<<<<<< SEARCH
            if (typeof adminViewMode !== 'undefined' && adminViewMode === 'seller') {
                clients = [];
                const hasSup = selectedComparisonSupervisors.size > 0;
                const hasVend = selectedComparisonVendedores.size > 0;
                const source = allClientsData;
                const len = source.length;
                for(let i=0; i<len; i++) {
                    const c = source instanceof ColumnarDataset ? source.get(i) : source[i];
                    const rca1 = String(c.rca1 || '').trim();
                    const isAmericanas = (c.razaoSocial || '').toUpperCase().includes('AMERICANAS');

                    if (window.userRole === 'adm' && !isAmericanas && rca1 === '') continue; // Skip strictly inactive

                    let keep = true;
                    if (hasSup || hasVend) {
                        const details = sellerDetailsMap.get(rca1);
                        if (hasSup) {
                            if (!details || !selectedComparisonSupervisors.has(details.supervisor)) keep = false;
                        }
                        if (keep && hasVend) {
                            if (!selectedComparisonVendedores.has(rca1)) keep = false;
                        }
                    }
                    if (keep) clients.push(c);
                }
            } else {
                clients = getHierarchyFilteredClients('comparison', allClientsData);

                // --- FIX: Apply Supervisor and Seller Filters in Standard Mode ---
                const hasSup = selectedComparisonSupervisors.size > 0;
                const hasVend = selectedComparisonVendedores.size > 0;

                if (hasSup || hasVend) {
                    const filteredClients = [];
                    const len = clients.length;
                    for (let i = 0; i < len; i++) {
                        const c = clients[i]; // already a proxy or object from getHierarchyFilteredClients
                        const rca1 = String(c.rca1 || '').trim();
                        let keep = true;

                        if (hasSup || hasVend) {
                            const details = sellerDetailsMap.get(rca1);
                            if (hasSup) {
                                if (!details || !selectedComparisonSupervisors.has(details.supervisor)) keep = false;
                            }
                            if (keep && hasVend) {
                                if (!selectedComparisonVendedores.has(rca1)) keep = false;
                            }
                        }
                        if (keep) filteredClients.push(c);
                    }
                    clients = filteredClients;
                }
                // -----------------------------------------------------------------
            }
=======
            if (typeof adminViewMode !== 'undefined' && adminViewMode === 'seller') {
                clients = [];
                const hasSup = selectedComparisonSupervisors.size > 0;
                const hasVend = selectedComparisonVendedores.size > 0;
                const source = allClientsData;
                const len = source.length;
                for(let i=0; i<len; i++) {
                    const c = source instanceof ColumnarDataset ? source.get(i) : source[i];
                    // Robust RCA access
                    const rca1 = String(c.rca1 || c['RCA 1'] || c.RCA1 || '').trim();
                    const isAmericanas = (c.razaoSocial || '').toUpperCase().includes('AMERICANAS');

                    if (window.userRole === 'adm' && !isAmericanas && rca1 === '') continue; // Skip strictly inactive

                    let keep = true;
                    if (hasSup || hasVend) {
                        const details = sellerDetailsMap.get(rca1);
                        if (hasSup) {
                            if (!details || !selectedComparisonSupervisors.has(details.supervisor)) keep = false;
                        }
                        if (keep && hasVend) {
                            if (!selectedComparisonVendedores.has(rca1)) keep = false;
                        }
                    }
                    if (keep) clients.push(c);
                }
            } else {
                clients = getHierarchyFilteredClients('comparison', allClientsData);

                // --- FIX: Apply Supervisor and Seller Filters in Standard Mode ---
                const hasSup = selectedComparisonSupervisors.size > 0;
                const hasVend = selectedComparisonVendedores.size > 0;

                if (hasSup || hasVend) {
                    const filteredClients = [];
                    const len = clients.length;
                    for (let i = 0; i < len; i++) {
                        const c = clients[i]; // already a proxy or object from getHierarchyFilteredClients
                        // Robust RCA access
                        const rca1 = String(c.rca1 || c['RCA 1'] || c.RCA1 || '').trim();
                        let keep = true;

                        if (hasSup || hasVend) {
                            const details = sellerDetailsMap.get(rca1);
                            if (hasSup) {
                                if (!details || !selectedComparisonSupervisors.has(details.supervisor)) keep = false;
                            }
                            if (keep && hasVend) {
                                if (!selectedComparisonVendedores.has(rca1)) keep = false;
                            }
                        }
                        if (keep) filteredClients.push(c);
                    }
                    clients = filteredClients;
                }
                // -----------------------------------------------------------------
            }
>>>>>>> REPLACE

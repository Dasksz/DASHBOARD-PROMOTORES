            // --- Chart: Share por Categoria (was Faturamento por Fornecedor) ---
            const supplierSales = new Map();
            // We want to group by "Supplier Name" (resolved), but also aggregate virtual categories if needed.
            // Actually, "Share por Categoria" implies we want the Category Logic (Elma, Foods, etc).
            // But the chart ID is 'faturamentoPorFornecedor'.
            
            // Logic: Group by CODFOR, but use resolved Name.
            // Special handling for Foods Virtual Categories if requested?
            // The image shows "Quaker / Kero Coco", "Toddy", "Toddynho", "Torcida", "Não Extrusados", "Extrusados".
            // These look like the keys from `SUPPLIER_CONFIG`.
            
            // Let's check `SUPPLIER_CONFIG` availability.
            const useConfig = typeof window.SUPPLIER_CONFIG !== 'undefined';

            filteredSales.forEach(s => {
                // Use getValueForSale to respect current metric (Faturamento vs Peso vs Bonus)
                // Note: The chart title says "Share por Categoria", usually implying Revenue (Faturamento).
                // However, respecting the global filter makes it consistent.
                // If the user selects "Bonificações" (Tipo 5/11), this will show Share of Bonus.
                const val = getValueForSale(s, selectedTiposVenda);
                let key = s.CODFOR;
                let label = s.CODFOR;

                if (useConfig) {
                    // Try to map to Virtual Category
                    if (window.isElma(key)) {
                        if (key === window.SUPPLIER_CODES.ELMA[0]) label = 'Extrusados';
                        else if (key === window.SUPPLIER_CODES.ELMA[1]) label = 'Não Extrusados'; // Batata/Tortilla
                        else if (key === window.SUPPLIER_CODES.ELMA[2]) label = 'Torcida';
                    } else if (window.isFoods(key)) {
                        // Virtual Split
                        const pObj = window.resolveDim('produtos', s.PRODUTO); // Use resolved product
                        const desc = String(pObj.descricao || '').toUpperCase();
                        
                        if (desc.includes('TODDYNHO')) label = 'Toddynho';
                        else if (desc.includes('TODDY')) label = 'Toddy';
                        else if (desc.includes('QUAKER') || desc.includes('KEROCOCO')) label = 'Quaker / Kero Coco';
                        else label = 'Outros Foods';
                    } else {
                        // Resolve Name for others
                        label = window.resolveDim('fornecedores', key);
                    }
                } else {
                     label = window.resolveDim('fornecedores', key);
                }

                supplierSales.set(label, (supplierSales.get(label) || 0) + val);
            });

            // Calculate Shares
            const totalSales = Array.from(supplierSales.values()).reduce((a, b) => a + b, 0);
            const radarData = [];
            
            supplierSales.forEach((val, label) => {
                const pct = totalSales > 0 ? (val / totalSales) * 100 : 0;
                radarData.push({
                    category: label,
                    value: pct,
                    full: 100, // Background
                    columnSettings: { fill: am5.color(0x67b7dc) } // Default color
                });
            });

            // Sort by Value Descending
            radarData.sort((a, b) => b.value - a.value);

            // Update Title
            const chartTitle = document.getElementById('faturamentoPorFornecedorTitle');
            if (chartTitle) {
                chartTitle.textContent = 'Share por Categoria';
            }

            // Render
            renderCategoryRadarChart(radarData);

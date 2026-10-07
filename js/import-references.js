(function (root) {
    const fileTables = {
        salesFile: ['data_detailed', 'data_orders', 'data_stock'],
        clientsFile: ['data_clients'],
        historyFile: ['data_history'],
        productsFile: ['data_product_details', 'data_active_products'],
        innovationsFile: ['data_innovations'], hierarchyFile: ['data_hierarchy'],
        titulosFile: ['data_titulos'],
        notaInvolvesFile1: ['data_nota_perfeita'], notaInvolvesFile2: ['data_nota_perfeita'],
        metasPesquisasFile: ['data_metas_pesquisas'], metasLojaPerfeitaFile: ['data_metas_loja_perfeita']
    };
    function plan(files) {
        const tables = new Set(Object.entries(fileTables).flatMap(([key, tables]) => files[key] ? tables : []));
        if (files.salesFile) ['data_product_details', 'data_active_products'].forEach(t => tables.add(t));
        if (files.salesFile || files.historyFile || files.productsFile || files.clientsFile) {
            ['dim_vendedores', 'dim_supervisores', 'dim_fornecedores', 'dim_produtos'].forEach(t => tables.add(t));
        }
        const sources = new Set();
        const needsSalesContext = files.historyFile || files.productsFile || files.clientsFile;
        const needsClients = files.salesFile || files.historyFile || files.notaInvolvesFile1 || files.notaInvolvesFile2;
        if (needsClients && !files.clientsFile) sources.add('clients');
        if (needsSalesContext && !files.salesFile) sources.add('sales');
        if (files.productsFile && !files.historyFile) sources.add('soldProducts');
        if (files.salesFile || needsSalesContext) {
            if (!files.productsFile) { sources.add('products'); sources.add('activeProducts'); }
            ['vendedores', 'supervisores', 'fornecedores', 'produtos'].forEach(s => sources.add(s));
        }
        return { tables: [...tables], sources: [...sources] };
    }
    async function load(client, files) {
        const importPlan = plan(files);
        const context = {};
        await Promise.all(importPlan.sources.map(async source => {
            const rows = [];
            let after = null;
            while (true) {
                const { data, error } = await client.rpc('get_import_reference_page_v1', {
                    p_source: source, p_after: after, p_limit: 2000
                });
                if (error) throw new Error(`Não foi possível consultar ${source}: ${error.message}`);
                if (!data || !Array.isArray(data.rows)) throw new Error(`Referência inválida: ${source}`);
                rows.push(...data.rows);
                if (data.rows.length < 2000) break;
                if (!data.next || data.next === after) throw new Error(`Paginação inválida: ${source}`);
                after = data.next;
            }
            context[source] = rows;
        }));
        for (const source of ['clients', 'sales']) {
            if (importPlan.sources.includes(source) && !context[source].length) {
                throw new Error(`Não há ${source === 'clients' ? 'cadastro de clientes' : 'vendas'} no banco. Envie também a planilha correspondente.`);
            }
        }
        return { context, importTables: importPlan.tables };
    }
    root.ImportReferences = { plan, load };
    if (typeof module !== 'undefined') module.exports = root.ImportReferences;
})(typeof window !== 'undefined' ? window : globalThis);

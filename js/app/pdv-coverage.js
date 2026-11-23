(function (root) {
    const norm = value => String(value ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g,' ');
    function parse(rows) {
        for (let i = 0; i < Math.min(rows.length, 30); i++) {
            const headers = rows[i].map(norm);
            const cols = ['CNPJ','ATIVO','PERFIL DO PDV'].map(key => headers.indexOf(key));
            if (cols.some(col => col < 0)) continue;
            const [cnpj, ativo, perfil] = cols;
            const values = new Set();
            let invalid = 0;
            for (const row of rows.slice(i + 1)) {
                if (norm(row[ativo]) !== 'SIM' || norm(row[perfil]) !== 'CONSTA NA META') continue;
                const raw = String(row[cnpj] ?? '').trim();
                const digits = raw.replace(/[\s./-]/g,'');
                if (!/^\d{10,14}$/.test(digits) || /^0+$/.test(digits)) { invalid++; continue; }
                values.add(digits.padStart(14,'0'));
            }
            return {cnpjs:[...values],invalid};
        }
        return null;
    }
    async function read(file, xlsx) {
        if (!/\.xlsx?$/i.test(file.name)) throw new Error('Selecione uma planilha Excel (.xlsx ou .xls).');
        const wb = xlsx.read(await file.arrayBuffer(), {type:'array'});
        const sheets = wb.SheetNames.map(name => parse(xlsx.utils.sheet_to_json(wb.Sheets[name],{header:1,raw:true,blankrows:false}))).filter(Boolean);
        if (sheets.length !== 1) throw new Error('O Excel deve ter uma única aba com as colunas CNPJ, Ativo e Perfil do PDV.');
        const result = sheets[0];
        if (result.invalid || !result.cnpjs.length) throw new Error(result.invalid ? `Há ${result.invalid} CNPJ(s) inválido(s) entre os PDVs elegíveis. A malha anterior foi mantida.` : 'Nenhum PDV ativo com perfil CONSTA NA META. A malha anterior foi mantida.');
        return result.cnpjs;
    }
    root.PdvCoverage = {parse,read};
})(globalThis);

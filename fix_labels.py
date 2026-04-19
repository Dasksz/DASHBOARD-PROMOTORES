import re

html_content = open('index.html', 'r', encoding='utf-8').read()

html_content = re.sub(
    r'<label class="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Vendas \(Mês Atual\)</label>',
    r'<label for="sales-file-input" class="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Vendas (Mês Atual)</label>',
    html_content
)

html_content = re.sub(
    r'<label class="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Cadastro de Clientes</label>',
    r'<label for="clients-file-input" class="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Cadastro de Clientes</label>',
    html_content
)

html_content = re.sub(
    r'<label class="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Cadastro de Produtos</label>',
    r'<label for="products-file-input" class="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Cadastro de Produtos</label>',
    html_content
)

html_content = re.sub(
    r'<label class="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Inovações \(Mês\)</label>',
    r'<label for="innovations-file-input" class="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Inovações (Mês)</label>',
    html_content
)

html_content = re.sub(
    r'<label class="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Estrutura de Equipe</label>',
    r'<label for="hierarchy-file-input" class="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Estrutura de Equipe</label>',
    html_content
)

html_content = re.sub(
    r'<label class="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Histórico \(Trimestre\)</label>',
    r'<label for="history-file-input" class="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Histórico (Trimestre)</label>',
    html_content
)

html_content = re.sub(
    r'<label class="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Títulos</label>',
    r'<label for="titulos-file-input" class="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Títulos</label>',
    html_content
)

html_content = re.sub(
    r'<label class="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Nota Involves - 1</label>',
    r'<label for="nota-involves-1-input" class="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Nota Involves - 1</label>',
    html_content
)

html_content = re.sub(
    r'<label class="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Nota Involves - 2</label>',
    r'<label for="nota-involves-2-input" class="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Nota Involves - 2</label>',
    html_content
)

html_content = re.sub(
    r'<label class="block mb-2 text-xs font-bold text-slate-500 uppercase">Cliente</label>\s*<div class="relative">\s*<div id="codcli-search-icon"',
    r'<label for="codcli-filter" class="block mb-2 text-xs font-bold text-slate-500 uppercase">Cliente</label>\n                        <div class="relative">\n                            <div id="codcli-search-icon"',
    html_content
)

open('index.html', 'w', encoding='utf-8').write(html_content)

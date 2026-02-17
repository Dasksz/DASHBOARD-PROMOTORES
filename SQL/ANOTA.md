🚨 1. Segurança (Crítico)
Esta é a área mais preocupante. Existem falhas que podem permitir que hackers roubem dados ou ganhem acesso administrativo.

Vulnerabilidade XSS (Cross-Site Scripting) no app.js:

Onde: Em várias funções de renderização, como renderRoteiroSuggestions ou na busca de clientes.

O Problema: O código insere dados da base de dados diretamente no HTML usando innerHTML.

Cenário: Se alguém mal-intencionado (ou um erro de importação) salvar um Cliente com o nome <img src=x onerror=alert('Hacked')>, esse script será executado no navegador de todos os utilizadores que pesquisarem esse cliente.

Exemplo no código:

JavaScript
// js/app/app.js (aprox. linha 4700)
div.innerHTML = `... <span class="..."> ${c.codigo_cliente}</span> ${c.fantasia} ...`;
Solução: Usar textContent para texto ou bibliotecas de sanitização (como DOMPurify). Nunca usar innerHTML com dados dinâmicos sem tratamento.

Armazenamento de Senhas em Texto Simples:

Onde: SQL/SQL_GERAL.sql (Tabela profiles).

O Problema: A coluna password text e o comentário -- Plain text password (Per User Request).

Risco: Se a base de dados for vazada (mesmo que parcialmente), todas as senhas estão expostas. Isso viola leis de proteção de dados (como a LGPD no Brasil). Mesmo que o cliente peça, é dever do programador recusar por ética e segurança.

Solução: As senhas devem ser geridas pelo Supabase Auth (que usa hashing seguro) e nunca salvas numa tabela personalizada.

Escalada de Privilégios (Trigger de Novo Usuário):

Onde: SQL/SQL_GERAL.sql (Função handle_new_user).

O Problema: O código confia cegamente nos metadados enviados pelo frontend:

SQL
-- O usuário pode injetar 'role': 'adm' no JSON de registro
v_name := new.raw_user_meta_data ->> 'full_name';
-- Se o trigger pegar o role daqui, um usuário cria sua conta já como Admin
Solução: Forçar o role padrão como 'user' ou 'pendente' dentro do Trigger, ignorando o que vem do frontend no momento do cadastro.

⚡ 2. Performance e Estabilidade
O sistema carrega muitos dados para a memória (o que é bom para velocidade), mas a forma como processa pode travar o navegador.

Processamento Pesado na Main Thread:

Onde: app.js, funções sanitizeData e normalizePastaInData.

O Problema: Estas funções iteram sobre todas as linhas de vendas (provavelmente milhares) assim que a página carrega, bloqueando a interface (congelando o clique) até terminar.

Solução: Mover essa lógica de limpeza de dados para o worker.js (que já existe) ou, idealmente, tratar esses dados no SQL/Supabase antes de os enviar para o Frontend.

Renderização de Tabelas Grandes:

O Problema: O código usa concatenação de strings (html += '<tr>...') e depois um único innerHTML. Embora melhor que inserir linha a linha, para tabelas grandes (Histórico/Pedidos), isso força o navegador a "repintar" (Reflow) uma área gigante de uma vez.

Solução: Implementar "Virtualização" (renderizar apenas o que está visível na tela) ou paginação estrita no servidor (Supabase) em vez de carregar tudo e paginar no cliente.

🛠 3. Qualidade de Código e Manutenção
"Magic Strings" e Números Mágicos:

Onde: Espalhado por todo o app.js.

Exemplo: O código verifica if (codFor === '707' || codFor === '1119' ...) em dezenas de lugares diferentes.

Risco: Se amanhã a Elma Chips mudar o código do fornecedor de '707' para '709', terás de caçar e substituir isso em 50 lugares no código, com grande chance de esquecer um e criar um bug.

Solução: Criar um objeto de configuração central (const FORNECEDORES = { ELMA: '707', FOODS: '1119' }) e usar essas constantes.

Gestão de Estado Frágil:

O Problema: O uso excessivo de variáveis globais (window.embeddedData, allSalesData, let mixRenderId = 0).

Risco: Torna muito difícil rastrear bugs. Se uma função altera allSalesData acidentalmente, outra parte do sistema quebra sem aviso. As variáveis de "Race Condition" (mixRenderId) são "gambiarras" para tentar evitar que dados antigos sobrescrevam novos, mas não é a solução ideal.

🔍 4. Edge Functions (Backend)
Falta de Validação de Auth:

Onde: supabase/functions/approve-visit/index.ts

O Problema: Pelo snippet fornecido:

TypeScript
serve(async (req) => {
  const url = new URL(req.url)
  const id = url.searchParams.get("id")
  // ... não vejo verificação de authUser aqui
})
Risco: Se esta função não validar o cabeçalho Authorization do Supabase, qualquer pessoa que descobrir a URL da função pode aprovar ou rejeitar visitas sem estar logada.

Resumo do Plano de Ação Recomendado:
Imediato (Segurança): Remover a coluna password do SQL e corrigir o XSS no app.js usando textContent.

Curto Prazo (Lógica): Centralizar os códigos de fornecedores (707, 1119, etc.) num único objeto de configuração.

Médio Prazo (Arquitetura): Mover o processamento pesado (normalizePasta) para o Web Worker.

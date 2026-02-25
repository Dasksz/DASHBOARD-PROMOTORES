# Instruções para Configuração do Supabase (Correção do Erro 401)

Para corrigir o erro `401 Unauthorized` ("Missing authorization header") ao clicar nos links de Aprovar ou Rejeitar visita no e-mail, é necessário desativar a verificação de JWT para essas funções específicas no painel do Supabase.

Isso ocorre porque os links enviados por e-mail são acessados diretamente pelo navegador sem estar logado no aplicativo, portanto não possuem o token de autenticação padrão.

### Passo a Passo:

1.  **Acesse o Dashboard do Supabase:**
    *   Faça login em sua conta do Supabase e selecione o projeto correspondente (`dldsocponbjthqxhmttj`).

2.  **Navegue até "Edge Functions":**
    *   No menu lateral esquerdo, clique no ícone de funções (geralmente chamado de **Edge Functions** ou ícone `fx`).

3.  **Localize a Função `approve-visit`:**
    *   Na lista de funções, clique na função chamada `approve-visit`.

4.  **Acesse as Configurações da Função:**
    *   Dentro da tela de detalhes da função, procure por uma aba ou botão de configurações (pode estar dentro de uma seção "Details" ou um ícone de engrenagem).
    *   Em versões mais recentes do painel, isso pode estar visível diretamente na lista ou na barra lateral de detalhes da função.

5.  **Desative "Enforce JWT Verification":**
    *   Encontre a opção **"Enforce JWT Verification"** (ou "Verify JWT").
    *   Mude a chave para a posição **OFF** (Desativado).
    *   Confirme a alteração se solicitado.

6.  **Repita para a Função `reject-visit`:**
    *   Volte para a lista de Edge Functions.
    *   Clique na função `reject-visit`.
    *   Desative a opção **"Enforce JWT Verification"** da mesma forma.

### Verificação:

Após realizar essas alterações, os links nos e-mails deverão funcionar corretamente sem exibir a mensagem de erro de autorização.

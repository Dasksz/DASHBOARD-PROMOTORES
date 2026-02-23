Plano de Implementação: Imagens de Produtos via Supabase StorageEste documento detalha o processo para exibir imagens de produtos no sistema sem precisar salvá-las diretamente no banco de dados.O Conceito Principal:
Em vez de guardar o "peso" da imagem no banco de dados, nós vamos guardar as imagens em uma "pasta na nuvem" (chamada de Bucket no Supabase). Como cada imagem tem o nome exato do código do produto (ex: 21913.jpg), o nosso site apenas junta o endereço da nuvem com o código do produto para exibir a foto correta.Fase 1: Configuração no Supabase (A Nuvem)O primeiro passo acontece fora do código, diretamente no painel de controle do seu Supabase.Passo 1: Acessar o StorageFaça login no painel do Supabase.Acesse o projeto atual (dashboard-promotores).No menu lateral esquerdo, clique em Storage (ícone de uma caixa/arquivo).Passo 2: Criar o Bucket (A Pasta Principal)Clique no botão "New Bucket" (Novo Bucket).Dê o nome de produtos (tudo minúsculo, sem espaços).MUITO IMPORTANTE: Marque a opção "Public bucket" (Bucket público). Isso é necessário para que o seu site consiga mostrar as imagens para os usuários sem pedir senha.Clique em "Save" (Salvar).Passo 3: Fazer o Upload das ImagensClique no bucket produtos que você acabou de criar.Arraste todas as suas imagens .jpg (aquelas do seu PC) para a área de upload, ou clique em "Upload files" para selecioná-las.Aguarde o carregamento concluir.Passo 4: Pegar a URL BaseApós subir uma imagem (ex: 21913.jpg), clique nela ou nos três pontinhos ao lado dela.Escolha a opção "Get URL" (Obter URL).A URL será algo parecido com isso:
https://[SEU_PROJETO].supabase.co/storage/v1/object/public/produtos/21913.jpgCopie a parte que vem antes do nome da imagem. Essa será a nossa URL Base:
https://[SEU_PROJETO].supabase.co/storage/v1/object/public/produtos/Fase 2: Implementação no Código (O Front-end)Agora vamos para os seus arquivos JavaScript (provavelmente dentro da pasta js/app/).Quando você faz a busca no banco de dados para listar os produtos, você recebe um objeto com os dados. Vamos usar a URL Base para criar o caminho da imagem.Exemplo de Implementação em JavaScript:// 1. Defina a URL base do seu Supabase Storage (Cole a URL que você pegou no Passo 4)
const STORAGE_PRODUTOS_URL = "https://[COLOQUE_SEU_ID_AQUI].supabase.co/storage/v1/object/public/produtos/";

/**
 * Função imaginária que desenha o produto na tela.
 * Adapte para a forma como você cria seu HTML hoje (pode ser com createElement ou template literals).
 */
function criarHtmlDoProduto(produto) {
    // 2. Montamos a URL completa dinamicamente!
    // Pegamos a URL base + o código do produto que veio do banco + a extensão .jpg
    const urlDaImagem = `${STORAGE_PRODUTOS_URL}${produto.codigo}.jpg`;

    // 3. Criamos o HTML do produto
    // O evento "onerror" é o nosso plano B: se a imagem não existir no Supabase, ele mostra a logo ou uma imagem padrão.
    const html = `
        <div class="produto-card">
            <img 
                src="${urlDaImagem}" 
                alt="Foto do produto: ${produto.descricao}"
                onerror="this.src='./imagens/logo.png'" 
                class="imagem-produto"
            />
            <h3>${produto.descricao}</h3>
            <p>Código: ${produto.codigo}</p>
        </div>
    `;

    return html;
}
Explicação do Código:STORAGE_PRODUTOS_URL: É a raiz do endereço. Nunca muda.${produto.codigo}.jpg: É a parte variável. O JavaScript substitui isso pelo código real (ex: 21913) a cada produto que ele desenhar na tela.onerror="this.src='./imagens/logo.png'": Esta é uma técnica essencial. Como você pode cadastrar um produto novo hoje e só subir a foto amanhã, essa linha garante que o site não mostre um erro na tela. Se o link falhar, ele troca para a logo padrão que você já tem no seu projeto.Fase 3: Testes e ValidaçãoApós implementar o código:Abra a página de produtos.Verifique se as imagens dos produtos que você fez upload estão aparecendo.Se alguma imagem não aparecer, clique com o botão direito na página, vá em "Inspecionar" -> aba "Console" ou "Network" e veja se a URL montada pelo JavaScript está exatamente igual à URL da imagem lá no painel do Supabase.Teste um produto que você sabe que não tem imagem para ver se a imagem padrão (logo.png) aparece corretamente graças ao onerror.

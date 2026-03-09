1. **Remover "capture" attribute e adicionar "multiple" nos inputs de foto**
   - Alterar `index.html` e localizar `#input-foto-geral`, `#input-foto-antes`, `#input-foto-depois`.
   - Remover o atributo `capture="environment"` (para que não force a câmera e permita selecionar da galeria).
   - Adicionar o atributo `multiple` nestes mesmos inputs (para que seja possível selecionar mais de uma foto por vez).

2. **Adaptar a leitura de arquivos múltiplos na submissão de fotos (`js/app/app.js` ou `js/app/app_part3.js`)**
   - Os inputs agora aceitam vários arquivos. O código que escuta o evento `change` nesses inputs precisará ser modificado para processar múltiplos arquivos com limites (10 para geral, 5 para antes/depois).
   - Ajustar as variáveis que armazenam as fotos (`fotosGerais`, `fotoAntes`, `fotoDepois` que agora precisarão ser um array também).

3. **Corrigir as tags de "Antes e Depois" no feed (`js/app/feed_view.js`)**
   - O feed atual não está exibindo as tags corretamente, mesmo para as fotos marcadas.
   - Analisar o parseamento das respostas de `respostasObj` para buscar a presença e exibir adequadamente o distintivo "Antes" e "Depois".

4. **Criar um carrossel de fotos no feed (`js/app/feed_view.js`)**
   - Quando houver mais de uma foto num post no feed, em vez de listar as fotos linearmente ou esconder, renderizar apenas a primeira foto e adicionar setas laterais (esquerda/direita).
   - Ao clicar nas setas, alternar a imagem exibida.
   - Adicionar o contador numérico dinâmico no topo superior direito da imagem (ex: `1/4`, `2/4`).

5. **Verificação (Pre-commit)**
   - Executar os passos do pre-commit para confirmar integridade antes de comitar.

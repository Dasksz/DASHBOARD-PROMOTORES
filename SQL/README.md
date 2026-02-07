# Instruções de Migração V2

Este diretório contém o script SQL unificado para migrar o sistema para o modo "Server-Side RPC".

## Passos para Atualização

1.  **Backup:** Faça um backup dos seus dados do Supabase.
2.  **Editor SQL:** Abra o Editor SQL do Supabase.
3.  **Executar Script:** Copie e cole o conteúdo de `full_system_v2.sql` e execute.
    *   Este script cria as tabelas necessárias (se não existirem), índices otimizados, e as funções RPC.
    *   Ele também configura as políticas de segurança (RLS).
4.  **Verificar Cache:** Após executar o script, execute o seguinte comando no Editor SQL para popular o cache inicial:
    ```sql
    SELECT refresh_dashboard_cache();
    ```
    *   Isso pode levar alguns minutos dependendo do volume de dados.

## Notas Técnicas

*   O frontend (`init.js`) agora inicializa em `isServerMode: true` e não baixa mais o banco de dados completo.
*   A filtragem é feita via RPC (`get_main_dashboard_data`, etc.).
*   Os filtros suspensos são populados dinamicamente via `get_dashboard_filters`.

# Resumo: Supabase Metrics API

**Fonte:** [Supabase Metrics Documentation](https://supabase.com/docs/guides/telemetry/metrics)

## O que é
Uma API compatível com o padrão **Prometheus** que expõe cerca de **200 métricas** de saúde e desempenho do banco de dados Postgres.

## Principais Benefícios
*   **Monitoramento Avançado:** Permite acompanhar o uso de CPU, Memória, Disco (IO), Conexões ativas e performance de queries em tempo real.
*   **Integração Flexível:** Conecta-se a ferramentas externas de observabilidade como **Grafana**, **Datadog** ou qualquer sistema compatível com Prometheus.
*   **Dashboards Personalizados:** Possibilita a criação de painéis visuais sob medida, superando as limitações dos gráficos padrão do Supabase Studio.
*   **Alertas e Histórico:** Permite configurar regras de alerta (ex: CPU > 90%) e manter histórico de dados de longo prazo.

## Observações Importantes
*   **Status:** Beta.
*   **Disponibilidade:** Disponível apenas para projetos na nuvem da Supabase (Cloud), não para instâncias self-hosted.

## Casos de Uso
1.  **Diagnóstico de Performance:** Identificar gargalos de CPU ou IO durante picos de carga.
2.  **Planejamento de Capacidade:** Monitorar o crescimento do uso de disco e conexões ao longo do tempo.
3.  **Alertas Críticos:** Receber notificações imediatas se o banco de dados ficar indisponível ou lento.

// Constants and Configurations

window.Rules = window.Rules || {};

window.Rules.SUPPLIER_CONFIG = {
    inference: {
        triggerKeywords: ['PEPSICO'],
        matchValue: 'PEPSICO',
        defaultValue: 'MULTIMARCAS'
    },
    metaRealizado: {
        requiredPasta: 'PEPSICO'
    }
};

window.Rules.GARBAGE_SELLER_KEYWORDS = ['TOTAL', 'GERAL', 'SUPERVISOR', 'BALCAO'];
window.Rules.GARBAGE_SELLER_EXACT = ['INATIVOS', 'N/A'];

window.Rules.FORBIDDEN_KEYS = ['SUPERV', 'CODUSUR', 'CODSUPERVISOR', 'NOME', 'CODCLI', 'PRODUTO', 'DESCRICAO', 'FORNECEDOR', 'OBSERVACAOFOR', 'CODFOR', 'QTVENDA', 'VLVENDA', 'VLBONIFIC', 'TOTPESOLIQ', 'ESTOQUEUNIT', 'TIPOVENDA', 'FILIAL', 'ESTOQUECX', 'SUPERVISOR', 'PASTA', 'RAMO', 'ATIVIDADE', 'CIDADE', 'MUNICIPIO', 'BAIRRO'];

window.Rules.GOALS_TARGETS = {
    '707': { fat: 0, vol: 0 },
    '708': { fat: 0, vol: 0 },
    '752': { fat: 0, vol: 0 },
    '1119_TODDYNHO': { fat: 0, vol: 0 },
    '1119_TODDY': { fat: 0, vol: 0 },
    '1119_QUAKER_KEROCOCO': { fat: 0, vol: 0 }
};

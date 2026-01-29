
export const SUPABASE_URL = 'https://dldsocponbjthqxhmttj.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsZHNvY3BvbmJqdGhxeGhtdHRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MzgzMzgsImV4cCI6MjA4NTAxNDMzOH0.IGxUEd977uIdhWvMzjDM8ygfISB_Frcf_2air8e3aOs';

export const FORBIDDEN_KEYS = ['SUPERV', 'CODUSUR', 'CODSUPERVISOR', 'NOME', 'CODCLI', 'PRODUTO', 'DESCRICAO', 'FORNECEDOR', 'OBSERVACAOFOR', 'CODFOR', 'QTVENDA', 'VLVENDA', 'VLBONIFIC', 'TOTPESOLIQ', 'ESTOQUEUNIT', 'TIPOVENDA', 'FILIAL', 'ESTOQUECX', 'SUPERVISOR', 'PASTA', 'RAMO', 'ATIVIDADE', 'CIDADE', 'MUNICIPIO', 'BAIRRO'];

export const MIX_SALTY_CATEGORIES = ['CHEETOS', 'DORITOS', 'FANDANGOS', 'RUFFLES', 'TORCIDA'];
export const MIX_FOODS_CATEGORIES = ['TODDYNHO', 'TODDY ', 'QUAKER', 'KEROCOCO'];

export const SUPPLIER_IDS = {
    ELMA_CHIPS: ['707', '708', '752'],
    FOODS: ['1119']
};

export const CATEGORY_IDS = {
    EXTRUSADOS: '707',
    NAO_EXTRUSADOS: '708',
    TORCIDA: '752',
    TODDYNHO: '1119_TODDYNHO',
    TODDY: '1119_TODDY',
    QUAKER_KEROCOCO: '1119_QUAKER_KEROCOCO'
};

export const SPECIAL_CLIENTS = {
    AMERICANAS: {
        NAME_KEY: 'AMERICANAS',
        RCA_ID: '1001'
    }
};

export const SPECIAL_RCAS = {
    BALCAO: '53',
    INATIVOS: '99', // As per worker.js logic change
    AMERICANAS: '1001'
};

export const CLIENT_MAP = {
    'CODIGO_CLIENTE': 'Código',
    'RCA1': 'RCA 1',
    'RCA2': 'RCA 2',
    'NOMECLIENTE': 'Cliente',
    'RAZAOSOCIAL': 'razaoSocial',
    'ULTIMACOMPRA': 'Data da Última Compra',
    'DATACADASTRO': 'Data e Hora de Cadastro',
    'INSCRICAOESTADUAL': 'Insc. Est. / Produtor',
    'CNPJ_CPF': 'CNPJ/CPF',
    'ENDERECO': 'Endereço Comercial',
    'TELEFONE': 'Telefone Comercial',
    'RCAS': 'rcas',
    'PROMOTOR': 'PROMOTOR'
};

export const QUARTERLY_DIVISOR = 3;

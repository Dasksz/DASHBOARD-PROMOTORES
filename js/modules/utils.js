import { CLIENT_MAP } from './constants.js';

export function normalizeKey(key) {
    if (!key) return '';
    const s = String(key).trim();
    // Remove leading zeros if it's a numeric string
    if (/^\d+$/.test(s)) {
        return String(parseInt(s, 10));
    }
    return s;
}

export function parseDate(dateString) {
    if (!dateString) return null;

    // Se já for um objeto Date, retorna diretamente
    if (dateString instanceof Date) {
        return !isNaN(dateString.getTime()) ? dateString : null;
    }

    // Se for um número (formato Excel ou Timestamp)
    if (typeof dateString === 'number') {
        // Excel Serial Date (approx < 50000 for current dates, Timestamp is > 1000000000000)
        if (dateString < 100000) return new Date(Math.round((dateString - 25569) * 86400 * 1000));
        // Timestamp
        return new Date(dateString);
    }

    if (typeof dateString !== 'string') return null;

    // Tentativa de parse para 'YYYY-MM-DDTHH:mm:ss.sssZ' ou 'YYYY-MM-DD'
    if (dateString.includes('T') || dateString.includes('-')) {
         // Adiciona 'Z' se não tiver informação de fuso horário para forçar UTC
        const isoString = dateString.endsWith('Z') ? dateString : dateString + 'Z';
        const isoDate = new Date(isoString);
        if (!isNaN(isoDate.getTime())) {
            return isoDate;
        }
    }

    // Tentativa de parse para 'DD/MM/YYYY'
    if (dateString.length === 10 && dateString.charAt(2) === '/' && dateString.charAt(5) === '/') {
        const [day, month, year] = dateString.split('/');
        if (year && month && day && year.length === 4) {
            // Cria a data em UTC para evitar problemas de fuso horário
            const utcDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
            if (!isNaN(utcDate.getTime())) {
                return utcDate;
            }
        }
    }

    // Fallback para outros formatos que o `new Date()` consegue interpretar
    const genericDate = new Date(dateString);
    if (!isNaN(genericDate.getTime())) {
        return genericDate;
    }

    return null;
}

export function formatDate(date) {
    if (!date) return '';
    const d = parseDate(date);
    if (!d || isNaN(d.getTime())) return '';
    const userTimezoneOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() + userTimezoneOffset).toLocaleDateString('pt-BR');
}

export function normalize(str) {
    return (str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
}

export function getFirstName(fullName) {
    return (fullName || '').split(' ')[0];
}

export function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

export function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

// Chunked Processor to prevent UI Freeze
export function runAsyncChunked(items, processItemFn, onComplete, isCancelled) {
    let index = 0;
    const total = items.length;

    // Check if items is a ColumnarDataset (duck typing check for .get method)
    const isColumnar = typeof items.get === 'function' && items.length !== undefined;

    function nextChunk() {
        if (isCancelled && isCancelled()) return;

        const start = performance.now();
        while (index < total) {
            const item = isColumnar ? items.get(index) : items[index];
            processItemFn(item, index);
            index++;

            if (index % 5 === 0 && performance.now() - start >= 12) { // Check budget frequently
                break;
            }
        }

        if (index < total) {
            requestAnimationFrame(nextChunk); // Yield to main thread
        } else {
            if(onComplete) onComplete();
        }
    }

    requestAnimationFrame(nextChunk);
}

// Helper to UPPERCASE keys (from init.js)
export function mapKeysToUpper(data, type) {
    if (!data || data.length === 0) return [];
    return data.map(item => {
        const newItem = {};
        for (const key in item) {
            let newKey = key.toUpperCase();
            if (type === 'clients') {
                if (CLIENT_MAP[newKey]) newKey = CLIENT_MAP[newKey];
                // Additional adjustments if needed, already in CLIENT_MAP usually
            }

            if (newKey === 'CLIENTE_NOME') newKey = 'CLIENTE_NOME';

            // Type validation
            if (item[key] !== null) {
                if (newKey === 'DTPED' || newKey === 'DTSAIDA' || newKey === 'Data da Última Compra' || newKey === 'Data e Hora de Cadastro') {
                     newItem[newKey] = item[key];
                } else if (['QTVENDA', 'VLVENDA', 'VLBONIFIC', 'TOTPESOLIQ', 'ESTOQUECX', 'ESTOQUEUNIT'].includes(newKey)) {
                     const val = Number(item[key]);
                     newItem[newKey] = isNaN(val) ? 0 : val;
                } else if (newKey === 'FILIAL') {
                     newItem[newKey] = String(item[key]);
                } else {
                     newItem[newKey] = item[key];
                }
            } else {
                 newItem[newKey] = item[key];
            }
        }
        return newItem;
    });
}

// Helper for parsing CSV
export const parseCSVToObjects = (text, type) => {
    const result = [];
    let headers = null;
    let currentVal = '';
    let currentLine = [];
    let inQuote = false;

    const pushLine = (lineValues) => {
        if (!headers) {
            headers = lineValues;
            return;
        }
        if (lineValues.length !== headers.length) return;

        const obj = {};
        for (let j = 0; j < headers.length; j++) {
            let header = headers[j].trim().toUpperCase();
            let val = lineValues[j];

            if (type === 'clients' && CLIENT_MAP[header]) header = CLIENT_MAP[header];
            if (type === 'orders' && ['VLVENDA', 'TOTPESOLIQ', 'VLBONIFIC', 'QTVENDA'].includes(header)) val = val === '' ? 0 : Number(val);

            // Normalize Client IDs
            if (header === 'CODCLI' || header === 'CODIGO_CLIENTE' || header === 'Código') {
                 val = normalizeKey(val);
            }

            if (val && typeof val === 'string' && val.startsWith('{') && val.endsWith('}')) {
                val = val.slice(1, -1).split(',').map(s => s.replace(/^"|"$/g, ''));
            }

            obj[header] = val;
        }
        result.push(obj);
    };

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (inQuote) {
            if (char === '"') {
                if (i + 1 < text.length && text[i + 1] === '"') { currentVal += '"'; i++; }
                else { inQuote = false; }
            } else { currentVal += char; }
        } else {
            if (char === '"') { inQuote = true; }
            else if (char === ',') { currentLine.push(currentVal); currentVal = ''; }
            else if (char === '\n' || char === '\r') {
                if (char === '\r' && i + 1 < text.length && text[i+1] === '\n') i++;
                currentLine.push(currentVal); currentVal = '';
                pushLine(currentLine); currentLine = [];
            } else { currentVal += char; }
        }
    }
    if (currentLine.length > 0 || currentVal !== '') { currentLine.push(currentVal); pushLine(currentLine); }
    return result;
};

export const parseCSVToColumnar = (text, type, existingColumnar = null) => {
    const columnar = existingColumnar || { columns: [], values: {}, length: 0 };
    const hasExistingColumns = columnar.columns.length > 0;
    let headers = hasExistingColumns ? columnar.columns : null;

    let currentVal = '';
    let currentLine = [];
    let inQuote = false;

    let skipFirstLine = hasExistingColumns;
    let isFirstLine = true;

    const pushLine = (lineValues) => {
        if (lineValues.length === 0 || (lineValues.length === 1 && lineValues[0] === '')) return;

        if (isFirstLine) {
            isFirstLine = false;
            if (skipFirstLine) return;

            headers = lineValues.map(h => {
                let header = h.trim().toUpperCase();
                if (type === 'clients' && CLIENT_MAP[header]) header = CLIENT_MAP[header];
                return header;
            });
            columnar.columns = headers;
            headers.forEach(h => { if (!columnar.values[h]) columnar.values[h] = []; });
            return;
        }

        if (headers && lineValues.length === headers.length) {
            for (let j = 0; j < headers.length; j++) {
                const header = headers[j];
                let val = lineValues[j];

                if (type === 'sales' || type === 'history') {
                    if (['QTVENDA', 'VLVENDA', 'VLBONIFIC', 'TOTPESOLIQ', 'ESTOQUECX', 'ESTOQUEUNIT', 'QTVENDA_EMBALAGEM_MASTER'].includes(header)) {
                        val = val === '' ? 0 : Number(val);
                    }
                }
                if (header === 'CODCLI' || header === 'CODIGO_CLIENTE' || header === 'Código') {
                     val = normalizeKey(val);
                }

                if (type === 'stock' && header === 'STOCK_QTY') val = val === '' ? 0 : Number(val);
                if (type === 'clients' && header === 'rcas') {
                    if (typeof val === 'string') {
                        val = val.trim();
                        if (val.startsWith('{')) {
                            val = val.slice(1, -1).split(',').map(s => s.replace(/^"|"$/g, ''));
                        } else if (val.startsWith('[')) {
                            try { val = JSON.parse(val); } catch(e) { val = [val]; }
                        } else if (val === '') {
                            val = [];
                        } else {
                            val = [val];
                        }
                    } else if (!val) {
                        val = [];
                    } else if (!Array.isArray(val)) {
                        val = [val];
                    }
                }

                columnar.values[header].push(val);
            }
            columnar.length++;
        }
    };

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (inQuote) {
            if (char === '"') {
                if (i + 1 < text.length && text[i + 1] === '"') { currentVal += '"'; i++; }
                else { inQuote = false; }
            } else { currentVal += char; }
        } else {
            if (char === '"') { inQuote = true; }
            else if (char === ',') { currentLine.push(currentVal); currentVal = ''; }
            else if (char === '\n' || char === '\r') {
                if (char === '\r' && i + 1 < text.length && text[i+1] === '\n') i++;
                currentLine.push(currentVal); currentVal = '';
                pushLine(currentLine); currentLine = [];
            } else { currentVal += char; }
        }
    }
    if (currentLine.length > 0 || currentVal !== '') { currentLine.push(currentVal); pushLine(currentLine); }
    return columnar;
};


const { performance } = require('perf_hooks');

// Optimized normalizeKey
function normalizeKeyOptimized(key) {
    if (key == null) return '';
    if (typeof key === 'number') return String(key);

    const s = String(key).trim();
    if (s.length === 0) return '';

    // Optimization: avoid regex for numeric check
    let isNumeric = true;
    for (let i = 0; i < s.length; i++) {
        const c = s.charCodeAt(i);
        if (c < 48 || c > 57) {
            isNumeric = false;
            break;
        }
    }

    if (isNumeric) {
        // Only parse if it has leading zeros that matter (length > 1 and starts with 0)
        if (s.length > 1 && s.charCodeAt(0) === 48) {
            return String(parseInt(s, 10));
        }
        return s;
    }
    return s;
}

// Generate test data
const iterations = 1000000;
const testData = [];
const types = [
    '9569',
    '7706',
    '0053',
    ' 12345 ',
    'ABC',
    12345,
    '000123456'
];

for (let i = 0; i < iterations; i++) {
    testData.push(types[i % types.length]);
}

// Benchmark
const start = performance.now();
let count = 0;
for (let i = 0; i < iterations; i++) {
    const rawRow = { CODCLI: testData[i], CODUSUR: '53' };

    // The code block to optimize
    let codCliOriginal = normalizeKeyOptimized(rawRow['CODCLI']);
    const rcaCheck = String(rawRow['CODUSUR'] || '').trim();
    if (codCliOriginal === '9569' && (rcaCheck === '53' || rcaCheck === '053')) {
        codCliOriginal = '7706';
    }

    if (codCliOriginal) count++;
}
const end = performance.now();

console.log(`Optimized Execution time: ${(end - start).toFixed(2)} ms`);

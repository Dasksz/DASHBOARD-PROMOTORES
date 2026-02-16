
const { performance } = require('perf_hooks');

// Original normalizeKey
function normalizeKeyOriginal(key) {
    if (!key) return '';
    const s = String(key).trim();
    // Remove leading zeros if it's a numeric string
    if (/^\d+$/.test(s)) {
        return String(parseInt(s, 10));
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
    let codCliOriginal = normalizeKeyOriginal(rawRow['CODCLI']);
    const rcaCheck = String(rawRow['CODUSUR'] || '').trim();
    if (codCliOriginal === '9569' && (rcaCheck === '53' || rcaCheck === '053')) {
        codCliOriginal = '7706';
    }

    if (codCliOriginal) count++;
}
const end = performance.now();

console.log(`Baseline Execution time: ${(end - start).toFixed(2)} ms`);

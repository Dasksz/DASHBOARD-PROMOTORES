
const assert = require('assert');

function normalizeKeyOriginal(key) {
    if (!key) return '';
    const s = String(key).trim();
    if (/^\d+$/.test(s)) {
        return String(parseInt(s, 10));
    }
    return s;
}

function normalizeKeyOptimized(key) {
    if (key == null) return '';
    if (typeof key === 'number') return String(key);

    const s = String(key).trim();
    if (s.length === 0) return '';

    let isNumeric = true;
    for (let i = 0; i < s.length; i++) {
        const c = s.charCodeAt(i);
        if (c < 48 || c > 57) {
            isNumeric = false;
            break;
        }
    }

    if (isNumeric) {
        if (s.length > 1 && s.charCodeAt(0) === 48) {
            return String(parseInt(s, 10));
        }
        return s;
    }
    return s;
}

const testCases = [
    { input: '9569', expected: '9569' },
    { input: 9569, expected: '9569' },
    { input: '009569', expected: '9569' },
    { input: ' 9569 ', expected: '9569' },
    { input: 'ABC', expected: 'ABC' },
    { input: '123A', expected: '123A' },
    { input: '0', expected: '0' },
    { input: '00', expected: '0' },
    { input: '', expected: '' },
    { input: null, expected: '' },
    { input: undefined, expected: '' },
    { input: '0123456789', expected: '123456789' },
    { input: '9007199254740991', expected: '9007199254740991' },
];

let failed = false;
testCases.forEach(tc => {
    const original = normalizeKeyOriginal(tc.input);
    const optimized = normalizeKeyOptimized(tc.input);

    if (tc.expected !== undefined && optimized !== tc.expected) {
         console.error(`FAILED on input ${tc.input}: Expected ${tc.expected}, got ${optimized}`);
         failed = true;
    }
    if (optimized !== original) {
        console.error(`MISMATCH on input ${tc.input}: Original ${original}, Optimized ${optimized}`);
        failed = true;
    }
});

if (!failed) {
    console.log("All tests passed!");
} else {
    process.exit(1);
}

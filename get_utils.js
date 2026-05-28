const fs = require('fs');
let utils = fs.readFileSync('js/app/utils.js', 'utf8');

// I'll make ColumnarDataset filter pass the RAW object/row values to the callback to avoid proxy overhead?
// BUT wait, a proxy IS exactly what we want to avoid memory overhead of creating an object.
// Wait, Proxy object creation is SLOW and consumes memory if we KEEP them in an array!
// And .filter() DOES keep them in an array! `result.push(item)`.
// `result` becomes a standard Array of Proxy objects. For 350,000 rows, that's 350,000 Proxy objects in memory (180MB+)!
// If we return a new ColumnarDataset containing only the filtered indices, it would take O(N) bits (or ints) of memory!

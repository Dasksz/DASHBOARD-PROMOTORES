## 2026/09/17 : (Fix KPI Metas Aggregation)
**Bug:** KPI goals for 'Pesquisas' and 'Loja Perfeita' were showing as 0 because the comparison `String(meta.mes) === currentMonthKey` was failing.
**Root Cause:** `currentMonthKey` is a 2-digit zero-padded string (e.g. `'09'`), while `meta.mes` from the database was unpadded (e.g. `'9'`).
**Fix:** Applied `.padStart(2, '0')` to `String(meta.mes)` to ensure the comparison always uses the same format.

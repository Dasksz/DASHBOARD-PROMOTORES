## Compressed maintenance archives

`compact_maintenance_backups_v1.sql` preserves the two October repair snapshots in batches of 500 JSON rows. PostgreSQL TOAST compresses the batches. It compares every original/reconstructed row and column before releasing the old storage, in one transaction. Public sales, history, visits, dimensions and dashboard summaries are untouched.

Read the original snapshots normally as database maintenance owner:

```sql
select * from dashboard_private.repair_20261019_rows;
select * from dashboard_private.duplicate_sales_backup_20261007;
select * from dashboard_private.maintenance_archive_manifest;
```

The original names are now read-only security-invoker views. Access remains restricted to the database owner. Their `_schema` tables retain the original row types, columns and constraints, without duplicate data. Compressed chunks and manifests also have RLS and no API grants.

If a full writable restoration is needed, do it in a transaction: lock the matching archive chunks, insert the view's rows into its empty `_schema` table, verify the count against `maintenance_archive_manifest.original_rows` and compare every column, drop the compatibility view, then rename the populated schema table to the original name. Keep the compressed archive until the restoration is verified. This restores a maintenance snapshot; it does not automatically restore or alter live sales.

Future maintenance snapshots should use compressed batches and a verified manifest rather than keeping additional permanent full-size copies of operational tables. Do not automatically delete snapshots by age, raw sales, or historical visits. Avoid removing indexes from dashboard summaries solely because their scan counters happen to be zero.

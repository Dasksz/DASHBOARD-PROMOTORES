-- Keep the existing schedule and access checks; only this job gets a longer budget.
SELECT cron.alter_job(
 job_id := (SELECT jobid FROM cron.job WHERE jobname='dashboard-page-summaries-v1'),
 command := 'SET statement_timeout = ''10min''; SELECT dashboard_private.refresh_summaries_v1(false);'
);

CREATE OR REPLACE FUNCTION public.get_cron_jobs()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_to_json(sub)::jsonb), '[]'::jsonb)
  FROM (
    SELECT 
      j.jobid,
      j.schedule,
      j.command,
      j.active,
      (
        SELECT jsonb_build_object(
          'status', d.status,
          'start_time', d.start_time,
          'end_time', d.end_time,
          'return_message', d.return_message
        )
        FROM cron.job_run_details d
        WHERE d.jobid = j.jobid
        ORDER BY d.start_time DESC
        LIMIT 1
      ) AS last_run
    FROM cron.job j
    ORDER BY j.jobid
  ) sub;
$$;
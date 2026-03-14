ALTER TABLE public.communication_logs
ADD COLUMN IF NOT EXISTS duration_minutes integer;

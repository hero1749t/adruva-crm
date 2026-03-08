
-- Automation rules table
CREATE TABLE public.automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  trigger_event text NOT NULL, -- lead_created, lead_status_changed, client_created, task_overdue
  trigger_conditions jsonb NOT NULL DEFAULT '{}'::jsonb, -- e.g. {"status": "lead_won"}
  actions jsonb NOT NULL DEFAULT '[]'::jsonb, -- array of actions [{type, config}]
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id),
  execution_count integer NOT NULL DEFAULT 0,
  last_executed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Automation execution logs
CREATE TABLE public.automation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES public.automation_rules(id) ON DELETE CASCADE,
  trigger_event text NOT NULL,
  trigger_entity_id uuid NOT NULL,
  actions_executed jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'success', -- success, partial, failed
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;

-- Owners can manage automation rules
CREATE POLICY "Owners can manage automation rules"
  ON public.automation_rules FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'owner'::user_role)
  WITH CHECK (get_user_role(auth.uid()) = 'owner'::user_role);

-- Admins can view and manage automation rules
CREATE POLICY "Admins can manage automation rules"
  ON public.automation_rules FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'admin'::user_role)
  WITH CHECK (get_user_role(auth.uid()) = 'admin'::user_role);

-- Authenticated users can view rules
CREATE POLICY "Authenticated can view automation rules"
  ON public.automation_rules FOR SELECT TO authenticated
  USING (true);

-- Owners and admins can view logs
CREATE POLICY "Owners and admins can view automation logs"
  ON public.automation_logs FOR SELECT TO authenticated
  USING (get_user_role(auth.uid()) = ANY(ARRAY['owner'::user_role, 'admin'::user_role]));

-- System inserts logs (via service role in edge function)
CREATE POLICY "System can insert automation logs"
  ON public.automation_logs FOR INSERT TO authenticated
  WITH CHECK (true);

-- Index for quick lookups
CREATE INDEX idx_automation_rules_trigger ON public.automation_rules(trigger_event, is_active);
CREATE INDEX idx_automation_logs_rule ON public.automation_logs(rule_id, created_at DESC);

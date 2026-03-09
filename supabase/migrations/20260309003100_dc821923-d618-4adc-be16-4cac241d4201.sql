-- Fix lead_activities RLS policy to restrict access to assigned users and admins
DROP POLICY IF EXISTS "Users can view lead activities" ON public.lead_activities;

CREATE POLICY "Users can view lead activities based on role"
ON public.lead_activities
FOR SELECT
USING (
  get_user_role(auth.uid()) = ANY (ARRAY['owner'::user_role, 'admin'::user_role])
  OR
  lead_id IN (
    SELECT id FROM public.leads WHERE assigned_to = auth.uid()
  )
);

-- Fix communication_logs RLS policy to restrict access to assigned users and admins
DROP POLICY IF EXISTS "Users can view communication logs" ON public.communication_logs;

CREATE POLICY "Users can view communication logs based on role"
ON public.communication_logs
FOR SELECT
USING (
  get_user_role(auth.uid()) = ANY (ARRAY['owner'::user_role, 'admin'::user_role])
  OR
  (
    entity_type = 'lead' 
    AND entity_id IN (SELECT id FROM public.leads WHERE assigned_to = auth.uid())
  )
  OR
  (
    entity_type = 'client'
    AND entity_id IN (SELECT id FROM public.clients WHERE assigned_manager = auth.uid())
  )
);
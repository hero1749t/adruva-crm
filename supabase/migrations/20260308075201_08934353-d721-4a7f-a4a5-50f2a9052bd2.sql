
-- Drop all existing RESTRICTIVE policies and recreate as PERMISSIVE

-- ===== PROFILES =====
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Owners and admins can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Authenticated users can view profiles"
ON public.profiles FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Owners and admins can insert profiles"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (
  (public.get_user_role(auth.uid()) IN ('owner', 'admin'))
  OR (auth.uid() = id)
);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Owners can update any profile"
ON public.profiles FOR UPDATE TO authenticated
USING (public.get_user_role(auth.uid()) = 'owner');

-- ===== LEADS =====
DROP POLICY IF EXISTS "Users can view leads based on role" ON public.leads;
DROP POLICY IF EXISTS "Owner and Admin can insert leads" ON public.leads;
DROP POLICY IF EXISTS "Owner and Admin can update leads" ON public.leads;
DROP POLICY IF EXISTS "Only Owner can delete leads" ON public.leads;

CREATE POLICY "Users can view leads based on role"
ON public.leads FOR SELECT TO authenticated
USING (
  public.get_user_role(auth.uid()) IN ('owner', 'admin')
  OR assigned_to = auth.uid()
);

CREATE POLICY "Owner and Admin can insert leads"
ON public.leads FOR INSERT TO authenticated
WITH CHECK (public.get_user_role(auth.uid()) IN ('owner', 'admin'));

CREATE POLICY "Owner and Admin can update leads"
ON public.leads FOR UPDATE TO authenticated
USING (
  public.get_user_role(auth.uid()) IN ('owner', 'admin')
  OR assigned_to = auth.uid()
);

CREATE POLICY "Only Owner can delete leads"
ON public.leads FOR DELETE TO authenticated
USING (public.get_user_role(auth.uid()) = 'owner');

-- ===== LEAD_ACTIVITIES =====
DROP POLICY IF EXISTS "Users can view lead activities" ON public.lead_activities;
DROP POLICY IF EXISTS "Authenticated users can insert activities" ON public.lead_activities;

CREATE POLICY "Users can view lead activities"
ON public.lead_activities FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert activities"
ON public.lead_activities FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());

-- ===== CLIENTS =====
DROP POLICY IF EXISTS "Users can view clients based on role" ON public.clients;
DROP POLICY IF EXISTS "System can insert clients" ON public.clients;
DROP POLICY IF EXISTS "Owner and Admin can update clients" ON public.clients;

CREATE POLICY "Users can view clients based on role"
ON public.clients FOR SELECT TO authenticated
USING (
  public.get_user_role(auth.uid()) IN ('owner', 'admin')
  OR assigned_manager = auth.uid()
);

CREATE POLICY "Owner and Admin can insert clients"
ON public.clients FOR INSERT TO authenticated
WITH CHECK (public.get_user_role(auth.uid()) IN ('owner', 'admin'));

CREATE POLICY "Owner and Admin can update clients"
ON public.clients FOR UPDATE TO authenticated
USING (public.get_user_role(auth.uid()) IN ('owner', 'admin'));

-- ===== TASKS =====
DROP POLICY IF EXISTS "Users can view tasks based on role" ON public.tasks;
DROP POLICY IF EXISTS "Owner and Admin can insert tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update tasks based on role" ON public.tasks;
DROP POLICY IF EXISTS "Owner and Admin can delete tasks" ON public.tasks;

CREATE POLICY "Users can view tasks based on role"
ON public.tasks FOR SELECT TO authenticated
USING (
  public.get_user_role(auth.uid()) IN ('owner', 'admin')
  OR assigned_to = auth.uid()
);

CREATE POLICY "Owner and Admin can insert tasks"
ON public.tasks FOR INSERT TO authenticated
WITH CHECK (public.get_user_role(auth.uid()) IN ('owner', 'admin'));

CREATE POLICY "Users can update tasks based on role"
ON public.tasks FOR UPDATE TO authenticated
USING (
  public.get_user_role(auth.uid()) IN ('owner', 'admin')
  OR assigned_to = auth.uid()
);

CREATE POLICY "Owner and Admin can delete tasks"
ON public.tasks FOR DELETE TO authenticated
USING (public.get_user_role(auth.uid()) IN ('owner', 'admin'));

-- ===== TASK_TEMPLATES =====
DROP POLICY IF EXISTS "Authenticated users can view templates" ON public.task_templates;
DROP POLICY IF EXISTS "Owners can manage templates" ON public.task_templates;

CREATE POLICY "Authenticated users can view templates"
ON public.task_templates FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Owners can manage templates"
ON public.task_templates FOR ALL TO authenticated
USING (public.get_user_role(auth.uid()) = 'owner');

-- ===== ACTIVITY_LOGS =====
DROP POLICY IF EXISTS "Owner and Admin can view logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Authenticated users can insert logs" ON public.activity_logs;

CREATE POLICY "Owner and Admin can view logs"
ON public.activity_logs FOR SELECT TO authenticated
USING (public.get_user_role(auth.uid()) IN ('owner', 'admin'));

CREATE POLICY "Authenticated users can insert logs"
ON public.activity_logs FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- Also need to allow the handle_lead_won trigger (SECURITY DEFINER) to insert clients/tasks
-- The trigger runs as the function owner so it bypasses RLS. This is already handled.

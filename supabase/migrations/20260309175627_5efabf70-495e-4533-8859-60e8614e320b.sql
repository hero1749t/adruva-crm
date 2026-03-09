
-- Convert ALL restrictive RLS policies to PERMISSIVE by dropping and recreating them

-- ============ activity_logs ============
DROP POLICY IF EXISTS "Authenticated users can insert logs" ON public.activity_logs;
CREATE POLICY "Authenticated users can insert logs" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Owner and Admin can view logs" ON public.activity_logs;
CREATE POLICY "Owner and Admin can view logs" ON public.activity_logs FOR SELECT TO authenticated USING (get_user_role(auth.uid()) = ANY (ARRAY['owner'::user_role, 'admin'::user_role]));

-- ============ automation_logs ============
DROP POLICY IF EXISTS "Owners and admins can insert automation logs" ON public.automation_logs;
CREATE POLICY "Owners and admins can insert automation logs" ON public.automation_logs FOR INSERT TO authenticated WITH CHECK (get_user_role(auth.uid()) = ANY (ARRAY['owner'::user_role, 'admin'::user_role]));

DROP POLICY IF EXISTS "Owners and admins can view automation logs" ON public.automation_logs;
CREATE POLICY "Owners and admins can view automation logs" ON public.automation_logs FOR SELECT TO authenticated USING (get_user_role(auth.uid()) = ANY (ARRAY['owner'::user_role, 'admin'::user_role]));

-- ============ automation_rules ============
DROP POLICY IF EXISTS "Admins can manage automation rules" ON public.automation_rules;
CREATE POLICY "Admins can manage automation rules" ON public.automation_rules FOR ALL TO authenticated USING (get_user_role(auth.uid()) = 'admin'::user_role) WITH CHECK (get_user_role(auth.uid()) = 'admin'::user_role);

DROP POLICY IF EXISTS "Authenticated can view automation rules" ON public.automation_rules;
CREATE POLICY "Authenticated can view automation rules" ON public.automation_rules FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Owners can manage automation rules" ON public.automation_rules;
CREATE POLICY "Owners can manage automation rules" ON public.automation_rules FOR ALL TO authenticated USING (get_user_role(auth.uid()) = 'owner'::user_role) WITH CHECK (get_user_role(auth.uid()) = 'owner'::user_role);

-- ============ clients ============
DROP POLICY IF EXISTS "Owner and Admin can insert clients" ON public.clients;
CREATE POLICY "Owner and Admin can insert clients" ON public.clients FOR INSERT TO authenticated WITH CHECK (get_user_role(auth.uid()) = ANY (ARRAY['owner'::user_role, 'admin'::user_role]));

DROP POLICY IF EXISTS "Owner and Admin can update clients" ON public.clients;
CREATE POLICY "Owner and Admin can update clients" ON public.clients FOR UPDATE TO authenticated USING (get_user_role(auth.uid()) = ANY (ARRAY['owner'::user_role, 'admin'::user_role]));

DROP POLICY IF EXISTS "Users can view clients based on role" ON public.clients;
CREATE POLICY "Users can view clients based on role" ON public.clients FOR SELECT TO authenticated USING ((get_user_role(auth.uid()) = ANY (ARRAY['owner'::user_role, 'admin'::user_role])) OR (assigned_manager = auth.uid()));

-- ============ communication_logs ============
DROP POLICY IF EXISTS "Owners and admins can delete communication logs" ON public.communication_logs;
CREATE POLICY "Owners and admins can delete communication logs" ON public.communication_logs FOR DELETE TO authenticated USING (get_user_role(auth.uid()) = ANY (ARRAY['owner'::user_role, 'admin'::user_role]));

DROP POLICY IF EXISTS "Users can insert communication logs" ON public.communication_logs;
CREATE POLICY "Users can insert communication logs" ON public.communication_logs FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can view communication logs based on role" ON public.communication_logs;
CREATE POLICY "Users can view communication logs based on role" ON public.communication_logs FOR SELECT TO authenticated USING ((get_user_role(auth.uid()) = ANY (ARRAY['owner'::user_role, 'admin'::user_role])) OR ((entity_type = 'lead'::text) AND (entity_id IN (SELECT leads.id FROM leads WHERE leads.assigned_to = auth.uid()))) OR ((entity_type = 'client'::text) AND (entity_id IN (SELECT clients.id FROM clients WHERE clients.assigned_manager = auth.uid()))));

-- ============ custom_field_definitions ============
DROP POLICY IF EXISTS "Admins can manage field definitions" ON public.custom_field_definitions;
CREATE POLICY "Admins can manage field definitions" ON public.custom_field_definitions FOR ALL TO authenticated USING (get_user_role(auth.uid()) = 'admin'::user_role) WITH CHECK (get_user_role(auth.uid()) = 'admin'::user_role);

DROP POLICY IF EXISTS "Authenticated can view field definitions" ON public.custom_field_definitions;
CREATE POLICY "Authenticated can view field definitions" ON public.custom_field_definitions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Owners can manage field definitions" ON public.custom_field_definitions;
CREATE POLICY "Owners can manage field definitions" ON public.custom_field_definitions FOR ALL TO authenticated USING (get_user_role(auth.uid()) = 'owner'::user_role) WITH CHECK (get_user_role(auth.uid()) = 'owner'::user_role);

-- ============ custom_field_values ============
DROP POLICY IF EXISTS "Authenticated can view field values" ON public.custom_field_values;
CREATE POLICY "Authenticated can view field values" ON public.custom_field_values FOR SELECT TO authenticated USING ((get_user_role(auth.uid()) = ANY (ARRAY['owner'::user_role, 'admin'::user_role])) OR ((entity_type = 'lead'::text) AND (entity_id IN (SELECT leads.id FROM leads WHERE leads.assigned_to = auth.uid()))) OR ((entity_type = 'client'::text) AND (entity_id IN (SELECT clients.id FROM clients WHERE clients.assigned_manager = auth.uid()))));

DROP POLICY IF EXISTS "Owners and admins can delete field values" ON public.custom_field_values;
CREATE POLICY "Owners and admins can delete field values" ON public.custom_field_values FOR DELETE TO authenticated USING (get_user_role(auth.uid()) = ANY (ARRAY['owner'::user_role, 'admin'::user_role]));

DROP POLICY IF EXISTS "Users can insert field values" ON public.custom_field_values;
CREATE POLICY "Users can insert field values" ON public.custom_field_values FOR INSERT TO authenticated WITH CHECK ((get_user_role(auth.uid()) = ANY (ARRAY['owner'::user_role, 'admin'::user_role])) OR ((entity_type = 'lead'::text) AND (entity_id IN (SELECT leads.id FROM leads WHERE leads.assigned_to = auth.uid()))) OR ((entity_type = 'client'::text) AND (entity_id IN (SELECT clients.id FROM clients WHERE clients.assigned_manager = auth.uid()))));

DROP POLICY IF EXISTS "Users can update field values" ON public.custom_field_values;
CREATE POLICY "Users can update field values" ON public.custom_field_values FOR UPDATE TO authenticated USING ((get_user_role(auth.uid()) = ANY (ARRAY['owner'::user_role, 'admin'::user_role])) OR ((entity_type = 'lead'::text) AND (entity_id IN (SELECT leads.id FROM leads WHERE leads.assigned_to = auth.uid()))) OR ((entity_type = 'client'::text) AND (entity_id IN (SELECT clients.id FROM clients WHERE clients.assigned_manager = auth.uid()))));

-- ============ custom_roles ============
DROP POLICY IF EXISTS "Authenticated users can view custom roles" ON public.custom_roles;
CREATE POLICY "Authenticated users can view custom roles" ON public.custom_roles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Owners can manage custom roles" ON public.custom_roles;
CREATE POLICY "Owners can manage custom roles" ON public.custom_roles FOR ALL TO authenticated USING (get_user_role(auth.uid()) = 'owner'::user_role) WITH CHECK (get_user_role(auth.uid()) = 'owner'::user_role);

-- ============ integrations ============
DROP POLICY IF EXISTS "Admins can view integrations" ON public.integrations;
CREATE POLICY "Admins can view integrations" ON public.integrations FOR SELECT TO authenticated USING (get_user_role(auth.uid()) = 'admin'::user_role);

DROP POLICY IF EXISTS "Owners can manage integrations" ON public.integrations;
CREATE POLICY "Owners can manage integrations" ON public.integrations FOR ALL TO authenticated USING (get_user_role(auth.uid()) = 'owner'::user_role) WITH CHECK (get_user_role(auth.uid()) = 'owner'::user_role);

-- ============ invoices ============
DROP POLICY IF EXISTS "Owner and Admin can insert invoices" ON public.invoices;
CREATE POLICY "Owner and Admin can insert invoices" ON public.invoices FOR INSERT TO authenticated WITH CHECK (get_user_role(auth.uid()) = ANY (ARRAY['owner'::user_role, 'admin'::user_role]));

DROP POLICY IF EXISTS "Owner and Admin can update invoices" ON public.invoices;
CREATE POLICY "Owner and Admin can update invoices" ON public.invoices FOR UPDATE TO authenticated USING (get_user_role(auth.uid()) = ANY (ARRAY['owner'::user_role, 'admin'::user_role]));

DROP POLICY IF EXISTS "Owner can delete invoices" ON public.invoices;
CREATE POLICY "Owner can delete invoices" ON public.invoices FOR DELETE TO authenticated USING (get_user_role(auth.uid()) = 'owner'::user_role);

DROP POLICY IF EXISTS "Users can view invoices based on role" ON public.invoices;
CREATE POLICY "Users can view invoices based on role" ON public.invoices FOR SELECT TO authenticated USING ((get_user_role(auth.uid()) = ANY (ARRAY['owner'::user_role, 'admin'::user_role])) OR (client_id IN (SELECT clients.id FROM clients WHERE clients.assigned_manager = auth.uid())));

-- ============ lead_activities ============
DROP POLICY IF EXISTS "Authenticated users can insert activities" ON public.lead_activities;
CREATE POLICY "Authenticated users can insert activities" ON public.lead_activities FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can view lead activities based on role" ON public.lead_activities;
CREATE POLICY "Users can view lead activities based on role" ON public.lead_activities FOR SELECT TO authenticated USING ((get_user_role(auth.uid()) = ANY (ARRAY['owner'::user_role, 'admin'::user_role])) OR (lead_id IN (SELECT leads.id FROM leads WHERE leads.assigned_to = auth.uid())));

-- ============ leads ============
DROP POLICY IF EXISTS "Only Owner can delete leads" ON public.leads;
CREATE POLICY "Only Owner can delete leads" ON public.leads FOR DELETE TO authenticated USING (get_user_role(auth.uid()) = 'owner'::user_role);

DROP POLICY IF EXISTS "Owner and Admin can insert leads" ON public.leads;
CREATE POLICY "Owner and Admin can insert leads" ON public.leads FOR INSERT TO authenticated WITH CHECK (get_user_role(auth.uid()) = ANY (ARRAY['owner'::user_role, 'admin'::user_role]));

DROP POLICY IF EXISTS "Users can update leads based on role" ON public.leads;
CREATE POLICY "Users can update leads based on role" ON public.leads FOR UPDATE TO authenticated USING ((get_user_role(auth.uid()) = ANY (ARRAY['owner'::user_role, 'admin'::user_role])) OR (assigned_to = auth.uid()));

DROP POLICY IF EXISTS "Users can view leads based on role" ON public.leads;
CREATE POLICY "Users can view leads based on role" ON public.leads FOR SELECT TO authenticated USING ((get_user_role(auth.uid()) = ANY (ARRAY['owner'::user_role, 'admin'::user_role])) OR (assigned_to = auth.uid()));

-- ============ notification_preferences ============
DROP POLICY IF EXISTS "Users can insert own preferences" ON public.notification_preferences;
CREATE POLICY "Users can insert own preferences" ON public.notification_preferences FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own preferences" ON public.notification_preferences;
CREATE POLICY "Users can update own preferences" ON public.notification_preferences FOR UPDATE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view own preferences" ON public.notification_preferences;
CREATE POLICY "Users can view own preferences" ON public.notification_preferences FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ============ notifications ============
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can delete own notifications" ON public.notifications FOR DELETE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert notifications" ON public.notifications;
CREATE POLICY "Users can insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()) OR (get_user_role(auth.uid()) = ANY (ARRAY['owner'::user_role, 'admin'::user_role])));

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ============ onboarding_checklist_items ============
DROP POLICY IF EXISTS "Owners and admins can delete onboarding items" ON public.onboarding_checklist_items;
CREATE POLICY "Owners and admins can delete onboarding items" ON public.onboarding_checklist_items FOR DELETE TO authenticated USING (get_user_role(auth.uid()) = ANY (ARRAY['owner'::user_role, 'admin'::user_role]));

DROP POLICY IF EXISTS "Owners and admins can insert onboarding items" ON public.onboarding_checklist_items;
CREATE POLICY "Owners and admins can insert onboarding items" ON public.onboarding_checklist_items FOR INSERT TO authenticated WITH CHECK (get_user_role(auth.uid()) = ANY (ARRAY['owner'::user_role, 'admin'::user_role]));

DROP POLICY IF EXISTS "Users can update onboarding items based on role" ON public.onboarding_checklist_items;
CREATE POLICY "Users can update onboarding items based on role" ON public.onboarding_checklist_items FOR UPDATE TO authenticated USING ((get_user_role(auth.uid()) = ANY (ARRAY['owner'::user_role, 'admin'::user_role])) OR (client_id IN (SELECT clients.id FROM clients WHERE clients.assigned_manager = auth.uid())));

DROP POLICY IF EXISTS "Users can view onboarding items based on role" ON public.onboarding_checklist_items;
CREATE POLICY "Users can view onboarding items based on role" ON public.onboarding_checklist_items FOR SELECT TO authenticated USING ((get_user_role(auth.uid()) = ANY (ARRAY['owner'::user_role, 'admin'::user_role])) OR (client_id IN (SELECT clients.id FROM clients WHERE clients.assigned_manager = auth.uid())));

-- ============ onboarding_templates ============
DROP POLICY IF EXISTS "Admins can manage onboarding templates" ON public.onboarding_templates;
CREATE POLICY "Admins can manage onboarding templates" ON public.onboarding_templates FOR ALL TO authenticated USING (get_user_role(auth.uid()) = 'admin'::user_role) WITH CHECK (get_user_role(auth.uid()) = 'admin'::user_role);

DROP POLICY IF EXISTS "Authenticated users can view onboarding templates" ON public.onboarding_templates;
CREATE POLICY "Authenticated users can view onboarding templates" ON public.onboarding_templates FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Owners can manage onboarding templates" ON public.onboarding_templates;
CREATE POLICY "Owners can manage onboarding templates" ON public.onboarding_templates FOR ALL TO authenticated USING (get_user_role(auth.uid()) = 'owner'::user_role) WITH CHECK (get_user_role(auth.uid()) = 'owner'::user_role);

-- ============ profiles ============
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Owners and admins can insert profiles" ON public.profiles;
CREATE POLICY "Owners and admins can insert profiles" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((get_user_role(auth.uid()) = ANY (ARRAY['owner'::user_role, 'admin'::user_role])) OR (auth.uid() = id));

DROP POLICY IF EXISTS "Owners can update any profile" ON public.profiles;
CREATE POLICY "Owners can update any profile" ON public.profiles FOR UPDATE TO authenticated USING (get_user_role(auth.uid()) = 'owner'::user_role);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK ((auth.uid() = id) AND (role = (SELECT p.role FROM profiles p WHERE p.id = auth.uid())) AND (status = (SELECT p.status FROM profiles p WHERE p.id = auth.uid())) AND (COALESCE(custom_role_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE((SELECT p.custom_role_id FROM profiles p WHERE p.id = auth.uid()), '00000000-0000-0000-0000-000000000000'::uuid)));

-- ============ recurring_task_templates ============
DROP POLICY IF EXISTS "Admins can manage recurring templates" ON public.recurring_task_templates;
CREATE POLICY "Admins can manage recurring templates" ON public.recurring_task_templates FOR ALL TO authenticated USING (get_user_role(auth.uid()) = 'admin'::user_role) WITH CHECK (get_user_role(auth.uid()) = 'admin'::user_role);

DROP POLICY IF EXISTS "Authenticated users can view recurring templates" ON public.recurring_task_templates;
CREATE POLICY "Authenticated users can view recurring templates" ON public.recurring_task_templates FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Owners can manage recurring templates" ON public.recurring_task_templates;
CREATE POLICY "Owners can manage recurring templates" ON public.recurring_task_templates FOR ALL TO authenticated USING (get_user_role(auth.uid()) = 'owner'::user_role) WITH CHECK (get_user_role(auth.uid()) = 'owner'::user_role);

-- ============ service_template_steps ============
DROP POLICY IF EXISTS "Admins can manage template steps" ON public.service_template_steps;
CREATE POLICY "Admins can manage template steps" ON public.service_template_steps FOR ALL TO authenticated USING (get_user_role(auth.uid()) = 'admin'::user_role) WITH CHECK (get_user_role(auth.uid()) = 'admin'::user_role);

DROP POLICY IF EXISTS "Authenticated users can view template steps" ON public.service_template_steps;
CREATE POLICY "Authenticated users can view template steps" ON public.service_template_steps FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Owners can manage template steps" ON public.service_template_steps;
CREATE POLICY "Owners can manage template steps" ON public.service_template_steps FOR ALL TO authenticated USING (get_user_role(auth.uid()) = 'owner'::user_role) WITH CHECK (get_user_role(auth.uid()) = 'owner'::user_role);

-- ============ service_templates ============
DROP POLICY IF EXISTS "Admins can manage service templates" ON public.service_templates;
CREATE POLICY "Admins can manage service templates" ON public.service_templates FOR ALL TO authenticated USING (get_user_role(auth.uid()) = 'admin'::user_role) WITH CHECK (get_user_role(auth.uid()) = 'admin'::user_role);

DROP POLICY IF EXISTS "Authenticated users can view service templates" ON public.service_templates;
CREATE POLICY "Authenticated users can view service templates" ON public.service_templates FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Owners can manage service templates" ON public.service_templates;
CREATE POLICY "Owners can manage service templates" ON public.service_templates FOR ALL TO authenticated USING (get_user_role(auth.uid()) = 'owner'::user_role) WITH CHECK (get_user_role(auth.uid()) = 'owner'::user_role);

-- ============ task_templates ============
DROP POLICY IF EXISTS "Authenticated users can view templates" ON public.task_templates;
CREATE POLICY "Authenticated users can view templates" ON public.task_templates FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Owners can manage templates" ON public.task_templates;
CREATE POLICY "Owners can manage templates" ON public.task_templates FOR ALL TO authenticated USING (get_user_role(auth.uid()) = 'owner'::user_role);

-- ============ tasks ============
DROP POLICY IF EXISTS "Owner and Admin can delete tasks" ON public.tasks;
CREATE POLICY "Owner and Admin can delete tasks" ON public.tasks FOR DELETE TO authenticated USING (get_user_role(auth.uid()) = ANY (ARRAY['owner'::user_role, 'admin'::user_role]));

DROP POLICY IF EXISTS "Owner and Admin can insert tasks" ON public.tasks;
CREATE POLICY "Owner and Admin can insert tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (get_user_role(auth.uid()) = ANY (ARRAY['owner'::user_role, 'admin'::user_role]));

DROP POLICY IF EXISTS "Users can update tasks based on role" ON public.tasks;
CREATE POLICY "Users can update tasks based on role" ON public.tasks FOR UPDATE TO authenticated USING ((get_user_role(auth.uid()) = ANY (ARRAY['owner'::user_role, 'admin'::user_role])) OR (assigned_to = auth.uid()));

DROP POLICY IF EXISTS "Users can view tasks based on role" ON public.tasks;
CREATE POLICY "Users can view tasks based on role" ON public.tasks FOR SELECT TO authenticated USING ((get_user_role(auth.uid()) = ANY (ARRAY['owner'::user_role, 'admin'::user_role])) OR (assigned_to = auth.uid()));

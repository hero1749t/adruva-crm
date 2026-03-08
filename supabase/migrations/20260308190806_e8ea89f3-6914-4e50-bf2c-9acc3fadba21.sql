
-- Onboarding step templates (configurable by owners/admins)
CREATE TABLE public.onboarding_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.onboarding_templates ENABLE ROW LEVEL SECURITY;

-- Everyone can view
CREATE POLICY "Authenticated users can view onboarding templates"
  ON public.onboarding_templates FOR SELECT TO authenticated
  USING (true);

-- Owners & admins can manage
CREATE POLICY "Owners can manage onboarding templates"
  ON public.onboarding_templates FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'owner')
  WITH CHECK (get_user_role(auth.uid()) = 'owner');

CREATE POLICY "Admins can manage onboarding templates"
  ON public.onboarding_templates FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'admin')
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

-- Per-client onboarding checklist items
CREATE TABLE public.onboarding_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.onboarding_templates(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  sort_order integer DEFAULT 0,
  is_completed boolean DEFAULT false,
  completed_at timestamptz,
  completed_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.onboarding_checklist_items ENABLE ROW LEVEL SECURITY;

-- View policy: owners/admins see all, team sees their assigned clients
CREATE POLICY "Users can view onboarding items based on role"
  ON public.onboarding_checklist_items FOR SELECT TO authenticated
  USING (
    get_user_role(auth.uid()) IN ('owner', 'admin')
    OR client_id IN (SELECT id FROM public.clients WHERE assigned_manager = auth.uid())
  );

-- Update policy
CREATE POLICY "Users can update onboarding items based on role"
  ON public.onboarding_checklist_items FOR UPDATE TO authenticated
  USING (
    get_user_role(auth.uid()) IN ('owner', 'admin')
    OR client_id IN (SELECT id FROM public.clients WHERE assigned_manager = auth.uid())
  );

-- Insert policy for owners/admins
CREATE POLICY "Owners and admins can insert onboarding items"
  ON public.onboarding_checklist_items FOR INSERT TO authenticated
  WITH CHECK (get_user_role(auth.uid()) IN ('owner', 'admin'));

-- Delete policy for owners/admins
CREATE POLICY "Owners and admins can delete onboarding items"
  ON public.onboarding_checklist_items FOR DELETE TO authenticated
  USING (get_user_role(auth.uid()) IN ('owner', 'admin'));

-- Index for fast lookups
CREATE INDEX idx_onboarding_checklist_client ON public.onboarding_checklist_items(client_id);

-- Insert default onboarding templates
INSERT INTO public.onboarding_templates (title, description, sort_order) VALUES
  ('Welcome Call', 'Schedule and complete introductory call with client', 1),
  ('Collect Brand Assets', 'Gather logo, brand guidelines, fonts, color palette', 2),
  ('Access Credentials', 'Get login access to website, hosting, analytics, ad accounts', 3),
  ('Website Audit', 'Complete initial website audit and document findings', 4),
  ('GMB Setup/Claim', 'Set up or claim Google My Business listing', 5),
  ('Social Media Access', 'Get access to all social media accounts', 6),
  ('Strategy Document', 'Create and share initial strategy document with client', 7),
  ('Kick-off Meeting', 'Present strategy and get client approval to proceed', 8);

-- Function to auto-create onboarding checklist when client is created
CREATE OR REPLACE FUNCTION public.create_onboarding_checklist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.onboarding_checklist_items (client_id, template_id, title, description, sort_order)
  SELECT NEW.id, t.id, t.title, t.description, t.sort_order
  FROM public.onboarding_templates t
  WHERE t.is_active = true
  ORDER BY t.sort_order;
  RETURN NEW;
END;
$$;

-- Trigger on client insert
CREATE TRIGGER trg_create_onboarding_checklist
  AFTER INSERT ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.create_onboarding_checklist();

-- updated_at trigger
CREATE TRIGGER update_onboarding_templates_updated_at
  BEFORE UPDATE ON public.onboarding_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_onboarding_checklist_updated_at
  BEFORE UPDATE ON public.onboarding_checklist_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

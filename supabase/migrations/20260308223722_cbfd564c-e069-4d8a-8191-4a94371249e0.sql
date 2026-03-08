
-- Table to store API integrations/keys configured by the owner
CREATE TABLE public.integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  provider text NOT NULL,
  api_key_encrypted text DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Only owners can manage integrations
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage integrations"
  ON public.integrations FOR ALL
  TO authenticated
  USING (get_user_role(auth.uid()) = 'owner'::user_role)
  WITH CHECK (get_user_role(auth.uid()) = 'owner'::user_role);

CREATE POLICY "Admins can view integrations"
  ON public.integrations FOR SELECT
  TO authenticated
  USING (get_user_role(auth.uid()) = 'admin'::user_role);

-- Service templates table for reusable project templates (SEO, Google Ads, Website etc.)
CREATE TABLE public.service_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'general',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.service_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view service templates"
  ON public.service_templates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Owners can manage service templates"
  ON public.service_templates FOR ALL
  TO authenticated
  USING (get_user_role(auth.uid()) = 'owner'::user_role)
  WITH CHECK (get_user_role(auth.uid()) = 'owner'::user_role);

CREATE POLICY "Admins can manage service templates"
  ON public.service_templates FOR ALL
  TO authenticated
  USING (get_user_role(auth.uid()) = 'admin'::user_role)
  WITH CHECK (get_user_role(auth.uid()) = 'admin'::user_role);

-- Steps within a service template
CREATE TABLE public.service_template_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.service_templates(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  deadline_offset_days integer DEFAULT 7,
  priority text DEFAULT 'medium'
);

ALTER TABLE public.service_template_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view template steps"
  ON public.service_template_steps FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Owners can manage template steps"
  ON public.service_template_steps FOR ALL
  TO authenticated
  USING (get_user_role(auth.uid()) = 'owner'::user_role)
  WITH CHECK (get_user_role(auth.uid()) = 'owner'::user_role);

CREATE POLICY "Admins can manage template steps"
  ON public.service_template_steps FOR ALL
  TO authenticated
  USING (get_user_role(auth.uid()) = 'admin'::user_role)
  WITH CHECK (get_user_role(auth.uid()) = 'admin'::user_role);

-- Add services field to clients for tracking which services they use
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS services text[] DEFAULT '{}';

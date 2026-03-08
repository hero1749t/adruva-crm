
-- Custom roles table with JSONB permissions
CREATE TABLE public.custom_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  is_system boolean NOT NULL DEFAULT false,
  permissions jsonb NOT NULL DEFAULT '{}',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add custom_role_id to profiles
ALTER TABLE public.profiles ADD COLUMN custom_role_id uuid REFERENCES public.custom_roles(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;

-- RLS: everyone can read roles
CREATE POLICY "Authenticated users can view custom roles"
ON public.custom_roles FOR SELECT TO authenticated
USING (true);

-- RLS: only owners can manage roles
CREATE POLICY "Owners can manage custom roles"
ON public.custom_roles FOR ALL TO authenticated
USING (get_user_role(auth.uid()) = 'owner')
WITH CHECK (get_user_role(auth.uid()) = 'owner');

-- Seed default system roles
INSERT INTO public.custom_roles (name, description, is_system, permissions) VALUES
('Owner', 'Full system access', true, '{
  "leads": {"create": true, "read": true, "update": true, "delete": true},
  "clients": {"create": true, "read": true, "update": true, "delete": true},
  "tasks": {"create": true, "read": true, "update": true, "delete": true},
  "invoices": {"create": true, "read": true, "update": true, "delete": true},
  "team": {"invite": true, "manage": true},
  "reports": {"view": true, "export": true},
  "settings": {"manage": true},
  "roles": {"manage": true}
}'::jsonb),
('Admin', 'Administrative access with invite capability', true, '{
  "leads": {"create": true, "read": true, "update": true, "delete": true},
  "clients": {"create": true, "read": true, "update": true, "delete": true},
  "tasks": {"create": true, "read": true, "update": true, "delete": true},
  "invoices": {"create": true, "read": true, "update": true, "delete": false},
  "team": {"invite": true, "manage": false},
  "reports": {"view": true, "export": true},
  "settings": {"manage": false},
  "roles": {"manage": false}
}'::jsonb),
('Team', 'Standard team member', true, '{
  "leads": {"create": false, "read": true, "update": true, "delete": false},
  "clients": {"create": false, "read": true, "update": true, "delete": false},
  "tasks": {"create": false, "read": true, "update": true, "delete": false},
  "invoices": {"create": false, "read": true, "update": false, "delete": false},
  "team": {"invite": false, "manage": false},
  "reports": {"view": false, "export": false},
  "settings": {"manage": false},
  "roles": {"manage": false}
}'::jsonb),
('Task Manager', 'Can only manage assigned tasks', true, '{
  "leads": {"create": false, "read": true, "update": true, "delete": false},
  "clients": {"create": false, "read": true, "update": false, "delete": false},
  "tasks": {"create": false, "read": true, "update": true, "delete": false},
  "invoices": {"create": false, "read": false, "update": false, "delete": false},
  "team": {"invite": false, "manage": false},
  "reports": {"view": false, "export": false},
  "settings": {"manage": false},
  "roles": {"manage": false}
}'::jsonb);

-- Assign existing profiles to system roles based on their current role
UPDATE public.profiles SET custom_role_id = (SELECT id FROM public.custom_roles WHERE name = 'Owner') WHERE role = 'owner';
UPDATE public.profiles SET custom_role_id = (SELECT id FROM public.custom_roles WHERE name = 'Admin') WHERE role = 'admin';
UPDATE public.profiles SET custom_role_id = (SELECT id FROM public.custom_roles WHERE name = 'Team') WHERE role = 'team';
UPDATE public.profiles SET custom_role_id = (SELECT id FROM public.custom_roles WHERE name = 'Task Manager') WHERE role = 'task_manager';

-- Create check_permission function
CREATE OR REPLACE FUNCTION public.check_permission(_user_id uuid, _resource text, _action text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT (cr.permissions -> _resource ->> _action)::boolean
      FROM public.profiles p
      JOIN public.custom_roles cr ON cr.id = p.custom_role_id
      WHERE p.id = _user_id
    ),
    -- Fallback: owners get everything, others get read-only
    CASE 
      WHEN (SELECT role FROM public.profiles WHERE id = _user_id) = 'owner' THEN true
      WHEN _action = 'read' THEN true
      ELSE false
    END
  );
$$;

-- Updated_at trigger for custom_roles
CREATE TRIGGER update_custom_roles_updated_at
  BEFORE UPDATE ON public.custom_roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- Custom fields definition table (Notion-style properties)
CREATE TABLE public.custom_field_definitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('lead', 'client')),
  field_key TEXT NOT NULL,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text' CHECK (field_type IN ('text', 'number', 'date', 'select', 'multi_select', 'url', 'email', 'phone', 'checkbox', 'currency')),
  options JSONB DEFAULT '[]'::jsonb,
  is_required BOOLEAN NOT NULL DEFAULT false,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (entity_type, field_key)
);

-- Custom field values table
CREATE TABLE public.custom_field_values (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  field_definition_id UUID NOT NULL REFERENCES public.custom_field_definitions(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('lead', 'client')),
  value JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (field_definition_id, entity_id)
);

CREATE INDEX idx_custom_field_definitions_entity_type ON public.custom_field_definitions(entity_type);
CREATE INDEX idx_custom_field_values_entity ON public.custom_field_values(entity_type, entity_id);
CREATE INDEX idx_custom_field_values_definition ON public.custom_field_values(field_definition_id);

CREATE TRIGGER update_custom_field_definitions_updated_at
  BEFORE UPDATE ON public.custom_field_definitions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_custom_field_values_updated_at
  BEFORE UPDATE ON public.custom_field_values
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.custom_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_field_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view field definitions"
  ON public.custom_field_definitions FOR SELECT USING (true);

CREATE POLICY "Owners can manage field definitions"
  ON public.custom_field_definitions FOR ALL
  USING (get_user_role(auth.uid()) = 'owner')
  WITH CHECK (get_user_role(auth.uid()) = 'owner');

CREATE POLICY "Admins can manage field definitions"
  ON public.custom_field_definitions FOR ALL
  USING (get_user_role(auth.uid()) = 'admin')
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Authenticated can view field values"
  ON public.custom_field_values FOR SELECT
  USING (
    get_user_role(auth.uid()) = ANY(ARRAY['owner'::user_role, 'admin'::user_role])
    OR (entity_type = 'lead' AND entity_id IN (SELECT id FROM public.leads WHERE assigned_to = auth.uid()))
    OR (entity_type = 'client' AND entity_id IN (SELECT id FROM public.clients WHERE assigned_manager = auth.uid()))
  );

CREATE POLICY "Users can insert field values"
  ON public.custom_field_values FOR INSERT
  WITH CHECK (
    get_user_role(auth.uid()) = ANY(ARRAY['owner'::user_role, 'admin'::user_role])
    OR (entity_type = 'lead' AND entity_id IN (SELECT id FROM public.leads WHERE assigned_to = auth.uid()))
    OR (entity_type = 'client' AND entity_id IN (SELECT id FROM public.clients WHERE assigned_manager = auth.uid()))
  );

CREATE POLICY "Users can update field values"
  ON public.custom_field_values FOR UPDATE
  USING (
    get_user_role(auth.uid()) = ANY(ARRAY['owner'::user_role, 'admin'::user_role])
    OR (entity_type = 'lead' AND entity_id IN (SELECT id FROM public.leads WHERE assigned_to = auth.uid()))
    OR (entity_type = 'client' AND entity_id IN (SELECT id FROM public.clients WHERE assigned_manager = auth.uid()))
  );

CREATE POLICY "Owners and admins can delete field values"
  ON public.custom_field_values FOR DELETE
  USING (get_user_role(auth.uid()) = ANY(ARRAY['owner'::user_role, 'admin'::user_role]));

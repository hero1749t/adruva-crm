CREATE TABLE public.recurring_task_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  priority public.task_priority DEFAULT 'medium',
  schedule_type text NOT NULL CHECK (schedule_type IN ('weekly', 'monthly')),
  schedule_day integer NOT NULL,
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_active boolean DEFAULT true,
  deadline_offset_days integer DEFAULT 3,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Validation trigger for schedule_day
CREATE OR REPLACE FUNCTION public.validate_recurring_schedule_day()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.schedule_type = 'weekly' AND (NEW.schedule_day < 0 OR NEW.schedule_day > 6) THEN
    RAISE EXCEPTION 'Weekly schedule_day must be 0-6 (Sun-Sat)';
  END IF;
  IF NEW.schedule_type = 'monthly' AND (NEW.schedule_day < 1 OR NEW.schedule_day > 28) THEN
    RAISE EXCEPTION 'Monthly schedule_day must be 1-28';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_recurring_schedule
  BEFORE INSERT OR UPDATE ON public.recurring_task_templates
  FOR EACH ROW EXECUTE FUNCTION public.validate_recurring_schedule_day();

-- Updated_at trigger
CREATE TRIGGER trg_recurring_updated_at
  BEFORE UPDATE ON public.recurring_task_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.recurring_task_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view recurring templates"
  ON public.recurring_task_templates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Owners can manage recurring templates"
  ON public.recurring_task_templates FOR ALL
  TO authenticated
  USING (get_user_role(auth.uid()) = 'owner')
  WITH CHECK (get_user_role(auth.uid()) = 'owner');

CREATE POLICY "Admins can manage recurring templates"
  ON public.recurring_task_templates FOR ALL
  TO authenticated
  USING (get_user_role(auth.uid()) = 'admin')
  WITH CHECK (get_user_role(auth.uid()) = 'admin');
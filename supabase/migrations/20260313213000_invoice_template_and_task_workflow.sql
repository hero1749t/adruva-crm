DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'client_status'
      AND e.enumlabel = 'new'
  ) THEN
    ALTER TYPE public.client_status ADD VALUE 'new';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'task_status'
      AND e.enumlabel = 'paused'
  ) THEN
    ALTER TYPE public.task_status ADD VALUE 'paused';
  END IF;
END $$;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS installment_type text NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'due',
  ADD COLUMN IF NOT EXISTS last_payment_date date,
  ADD COLUMN IF NOT EXISTS next_payment_date date;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS business_name text,
  ADD COLUMN IF NOT EXISTS service_template_id uuid REFERENCES public.service_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS service_template_name text,
  ADD COLUMN IF NOT EXISTS paused_reason text;

CREATE TABLE IF NOT EXISTS public.client_service_template_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  service_template_id uuid NOT NULL REFERENCES public.service_templates(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assignment_name text,
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE (client_id, service_template_id)
);

ALTER TABLE public.client_service_template_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view template assignments" ON public.client_service_template_assignments;
CREATE POLICY "Users can view template assignments"
  ON public.client_service_template_assignments
  FOR SELECT TO authenticated
  USING (
    get_user_role(auth.uid()) = ANY (ARRAY['owner'::public.user_role, 'admin'::public.user_role])
    OR client_id IN (
      SELECT c.id
      FROM public.clients c
      WHERE c.assigned_manager = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners and admins can manage template assignments" ON public.client_service_template_assignments;
CREATE POLICY "Owners and admins can manage template assignments"
  ON public.client_service_template_assignments
  FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = ANY (ARRAY['owner'::public.user_role, 'admin'::public.user_role]))
  WITH CHECK (get_user_role(auth.uid()) = ANY (ARRAY['owner'::public.user_role, 'admin'::public.user_role]));

CREATE INDEX IF NOT EXISTS idx_invoices_next_payment_date
  ON public.invoices(next_payment_date);

CREATE INDEX IF NOT EXISTS idx_invoices_payment_status
  ON public.invoices(payment_status);

CREATE INDEX IF NOT EXISTS idx_tasks_service_template_id
  ON public.tasks(service_template_id);

CREATE INDEX IF NOT EXISTS idx_client_service_template_assignments_client_id
  ON public.client_service_template_assignments(client_id);

CREATE INDEX IF NOT EXISTS idx_client_service_template_assignments_template_id
  ON public.client_service_template_assignments(service_template_id);

UPDATE public.tasks t
SET business_name = COALESCE(c.company_name, c.client_name)
FROM public.clients c
WHERE t.client_id = c.id
  AND t.business_name IS NULL;

UPDATE public.invoices
SET next_payment_date = due_date
WHERE next_payment_date IS NULL;

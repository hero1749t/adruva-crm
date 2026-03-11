
-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Owner and Admin can insert tasks" ON public.tasks;

-- Allow all authenticated users to insert tasks (assigned_to will be set to their own id for team members)
CREATE POLICY "Authenticated users can insert tasks"
ON public.tasks FOR INSERT
TO authenticated
WITH CHECK (
  (get_user_role(auth.uid()) = ANY (ARRAY['owner'::user_role, 'admin'::user_role]))
  OR (assigned_to = auth.uid())
);

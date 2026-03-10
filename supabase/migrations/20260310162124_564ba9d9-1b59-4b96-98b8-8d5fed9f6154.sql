
-- Drop existing insert policy
DROP POLICY IF EXISTS "Owner and Admin can insert clients" ON public.clients;

-- Create new policy allowing all authenticated users to insert clients
-- but they must set assigned_manager to themselves
CREATE POLICY "Authenticated users can insert clients"
ON public.clients FOR INSERT
TO authenticated
WITH CHECK (
  (get_user_role(auth.uid()) IN ('owner', 'admin'))
  OR
  (assigned_manager = auth.uid())
);

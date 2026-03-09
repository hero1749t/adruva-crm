-- Fix privilege escalation vulnerability in profiles table
-- Drop the existing policy that allows users to update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Recreate it with proper WITH CHECK to prevent privilege escalation
-- Users can update their own profile BUT cannot change role, status, or custom_role_id
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id 
  AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
  AND status = (SELECT status FROM public.profiles WHERE id = auth.uid())
  AND COALESCE(custom_role_id, '00000000-0000-0000-0000-000000000000'::uuid) = 
      COALESCE((SELECT custom_role_id FROM public.profiles WHERE id = auth.uid()), '00000000-0000-0000-0000-000000000000'::uuid)
);
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS can_view_unassigned boolean NOT NULL DEFAULT false;


-- Communication logs table for both leads and clients
CREATE TABLE public.communication_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('lead', 'client')),
  entity_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('call', 'email', 'whatsapp', 'meeting', 'note')),
  direction TEXT NOT NULL DEFAULT 'outbound' CHECK (direction IN ('inbound', 'outbound')),
  subject TEXT,
  content TEXT NOT NULL,
  duration_minutes INTEGER,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_comm_logs_entity ON public.communication_logs(entity_type, entity_id);
CREATE INDEX idx_comm_logs_created_at ON public.communication_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.communication_logs ENABLE ROW LEVEL SECURITY;

-- RLS: Authenticated users can view communication logs
CREATE POLICY "Users can view communication logs"
  ON public.communication_logs FOR SELECT TO authenticated
  USING (true);

-- RLS: Authenticated users can insert their own logs
CREATE POLICY "Users can insert communication logs"
  ON public.communication_logs FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

-- RLS: Owners/admins can delete logs
CREATE POLICY "Owners and admins can delete communication logs"
  ON public.communication_logs FOR DELETE TO authenticated
  USING (get_user_role(auth.uid()) IN ('owner', 'admin'));

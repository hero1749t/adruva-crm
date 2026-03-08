import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

interface LogParams {
  entity: string;
  entityId: string;
  action: string;
  metadata?: Record<string, unknown>;
}

export async function logActivity({ entity, entityId, action, metadata }: LogParams) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("activity_logs").insert({
    user_id: user.id,
    entity,
    entity_id: entityId,
    action,
    metadata: (metadata as Json) || null,
  });
}

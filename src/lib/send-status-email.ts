import { supabase } from "@/integrations/supabase/client";

export async function sendStatusEmail({
  entity,
  entityName,
  oldStatus,
  newStatus,
  assignedTo,
}: {
  entity: "lead" | "task";
  entityName: string;
  oldStatus: string;
  newStatus: string;
  assignedTo?: string | null;
}) {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return;

    await supabase.functions.invoke("send-status-email", {
      body: { entity, entityName, oldStatus, newStatus, assignedTo },
    });
  } catch (err) {
    console.error("Failed to send status email:", err);
  }
}

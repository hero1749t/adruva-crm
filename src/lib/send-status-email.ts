import { invokeSupabaseFunction } from "@/lib/supabase-function-fallback";

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
    await invokeSupabaseFunction("send-status-email", {
      entity,
      entityName,
      oldStatus,
      newStatus,
      assignedTo,
    });
  } catch (err) {
    console.error("Failed to send status email:", err);
  }
}

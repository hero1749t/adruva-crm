import { supabase } from "@/integrations/supabase/client";

export async function notifyLeadAssigned({
  leadName,
  assignedToId,
  assignedToName,
}: {
  leadName: string;
  assignedToId: string;
  assignedToName?: string;
}) {
  try {
    await supabase.functions.invoke("notify-lead-assigned", {
      body: { leadName, assignedToId, assignedToName },
    });
  } catch (err) {
    console.error("Failed to send lead assigned email:", err);
  }
}

export async function notifyClientCreated({
  clientName,
  companyName,
  assignedManager,
  plan,
}: {
  clientName: string;
  companyName?: string | null;
  assignedManager?: string | null;
  plan?: string | null;
}) {
  try {
    await supabase.functions.invoke("notify-client-created", {
      body: { clientName, companyName, assignedManager, plan },
    });
  } catch (err) {
    console.error("Failed to send client created email:", err);
  }
}

export async function notifyTaskAssigned({
  taskTitle,
  assignedToId,
  assignedToName,
  clientName,
  deadline,
}: {
  taskTitle: string;
  assignedToId: string;
  assignedToName?: string;
  clientName?: string;
  deadline?: string;
}) {
  try {
    await supabase.functions.invoke("notify-task-assigned", {
      body: { taskTitle, assignedToId, assignedToName, clientName, deadline },
    });
  } catch (err) {
    console.error("Failed to send task assigned email:", err);
  }
}

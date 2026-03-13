import { supabase } from "@/integrations/supabase/client";

type NotificationType =
  | "assignment"
  | "lead_won"
  | "client_created"
  | "overdue"
  | "due_today"
  | "due_tomorrow"
  | "system";

type TeamProfile = {
  id: string;
  name: string;
  role: string;
};

const today = () => new Date().toISOString().slice(0, 10);

const insertNotifications = async (
  notifications: Array<{
    user_id: string;
    type: NotificationType;
    title: string;
    message: string;
    task_id?: string | null;
  }>
) => {
  const unique = new Map<string, (typeof notifications)[number]>();

  notifications.forEach((notification) => {
    const key = [
      notification.user_id,
      notification.type,
      notification.title,
      notification.message,
      notification.task_id || "",
    ].join(":");
    unique.set(key, notification);
  });

  if (unique.size === 0) {
    return;
  }

  const { error } = await supabase.from("notifications").insert(
    Array.from(unique.values()).map((notification) => ({
      ...notification,
      notification_date: today(),
    }))
  );

  if (error) {
    console.error("Failed to insert in-app notifications:", error);
  }
};

export const getNotificationRecipientsByRoles = async (roles: readonly ("admin" | "owner" | "task_manager" | "team")[]) => {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, role")
    .eq("status", "active")
    .in("role", roles as unknown as string[])
    .order("name");

  if (error) {
    console.error("Failed to fetch notification recipients:", error);
    return [] as TeamProfile[];
  }

  return (data || []) as TeamProfile[];
};

export const notifyLeadAssignmentInApp = async ({
  leadName,
  assignedToId,
  assignedToName,
}: {
  leadName: string;
  assignedToId: string;
  assignedToName?: string;
}) => {
  await insertNotifications([
    {
      user_id: assignedToId,
      type: "assignment",
      title: "New lead assigned",
      message: `${leadName} has been assigned to ${assignedToName || "you"}.`,
    },
  ]);
};

export const notifyTaskAssignmentInApp = async ({
  taskId,
  taskTitle,
  assignedToId,
  assignedToName,
  clientName,
}: {
  taskId?: string;
  taskTitle: string;
  assignedToId: string;
  assignedToName?: string;
  clientName?: string;
}) => {
  await insertNotifications([
    {
      user_id: assignedToId,
      task_id: taskId || null,
      type: "assignment",
      title: "New task assigned",
      message: `${taskTitle}${clientName ? ` for ${clientName}` : ""} has been assigned to ${assignedToName || "you"}.`,
    },
  ]);
};

export const notifyLeadWonInApp = async ({
  leadName,
  assignedManagerId,
  assignedManagerName,
}: {
  leadName: string;
  assignedManagerId?: string | null;
  assignedManagerName?: string;
}) => {
  const managers = await getNotificationRecipientsByRoles(["owner", "admin"]);
  const notifications = managers.map((manager) => ({
    user_id: manager.id,
    type: "lead_won" as NotificationType,
    title: "Lead converted to client",
    message: `${leadName} was marked as won and converted into a client.`,
  }));

  if (assignedManagerId) {
    notifications.push({
      user_id: assignedManagerId,
      type: "client_created" as NotificationType,
      title: "Client assigned to you",
      message: `${leadName} is now your active client${assignedManagerName ? `, ${assignedManagerName}` : ""}.`,
    });
  }

  await insertNotifications(notifications);
};

export const seedNotificationInbox = async (profiles: TeamProfile[]) => {
  await insertNotifications(
    profiles.map((profile) => ({
      user_id: profile.id,
      type: "system" as NotificationType,
      title: `Welcome ${profile.name}`,
      message:
        profile.role === "owner" || profile.role === "admin"
          ? "Your dashboard is ready. You'll receive role-based updates here."
          : "Your assigned leads, tasks, and client updates will appear here.",
    }))
  );
};

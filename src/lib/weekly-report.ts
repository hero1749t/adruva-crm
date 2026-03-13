import { supabase } from "@/integrations/supabase/client";

const DEFAULT_PRODUCTION_API_BASE = "https://adruva-crm.vercel.app";

const getWeeklyReportApiBase = () => {
  const configuredBase = import.meta.env.VITE_APP_API_BASE_URL?.trim();
  if (configuredBase) {
    return configuredBase.replace(/\/$/, "");
  }

  if (typeof window === "undefined") {
    return "";
  }

  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return DEFAULT_PRODUCTION_API_BASE;
  }

  return window.location.origin;
};

const extractErrorMessage = async (response: Response) => {
  try {
    const payload = await response.json();
    return payload?.error || payload?.message || `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
};

export const sendWeeklyReport = async () => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const accessToken = session?.access_token;
  if (!accessToken) {
    throw new Error("Please log in again and retry.");
  }

  const response = await fetch(`${getWeeklyReportApiBase()}/api/weekly-report`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }

  return response.json().catch(() => ({ success: true }));
};

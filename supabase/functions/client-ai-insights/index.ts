import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { clientId } = await req.json();
    if (!clientId) throw new Error("clientId is required");

    // Fetch client data
    const { data: client, error: clientErr } = await supabase
      .from("clients")
      .select("*")
      .eq("id", clientId)
      .single();
    if (clientErr) throw clientErr;

    // Fetch tasks
    const { data: tasks } = await supabase
      .from("tasks")
      .select("task_title, status, priority, deadline, completed_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(20);

    // Fetch recent invoices
    const { data: invoices } = await supabase
      .from("invoices")
      .select("invoice_number, status, total_amount, due_date, paid_date")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(10);

    // Fetch recent communication logs
    const { data: commsLogs } = await supabase
      .from("communication_logs")
      .select("type, direction, subject, created_at")
      .eq("entity_id", clientId)
      .eq("entity_type", "client")
      .order("created_at", { ascending: false })
      .limit(15);

    // Fetch onboarding progress
    const { data: onboarding } = await supabase
      .from("onboarding_checklist_items")
      .select("title, is_completed")
      .eq("client_id", clientId);

    const today = new Date().toISOString().split("T")[0];

    const prompt = `You are an expert CRM analyst for a digital marketing agency. Analyze this client data and provide actionable insights.

CLIENT INFO:
- Name: ${client.client_name}
- Company: ${client.company_name || "N/A"}
- Plan: ${client.plan || "N/A"}
- Status: ${client.status}
- Billing: ${client.billing_status}
- Monthly Payment: ₹${client.monthly_payment || 0}
- Start Date: ${client.start_date || "N/A"}
- Contract End: ${client.contract_end_date || "N/A"}
- Today: ${today}

TASKS (${tasks?.length || 0}):
${tasks?.map((t) => `- ${t.task_title} | ${t.status} | ${t.priority} | Due: ${t.deadline || "N/A"}`).join("\n") || "None"}

INVOICES (${invoices?.length || 0}):
${invoices?.map((i) => `- ${i.invoice_number} | ${i.status} | ₹${i.total_amount} | Due: ${i.due_date} | Paid: ${i.paid_date || "N/A"}`).join("\n") || "None"}

COMMUNICATIONS (${commsLogs?.length || 0}):
${commsLogs?.map((c) => `- ${c.type} (${c.direction}) | ${c.subject || "No subject"} | ${c.created_at}`).join("\n") || "None"}

ONBOARDING (${onboarding?.length || 0} items):
${onboarding?.map((o) => `- ${o.title}: ${o.is_completed ? "✅" : "❌"}`).join("\n") || "None"}

Respond using this tool to return structured insights.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a CRM analytics AI. Always respond via the provided tool." },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_insights",
              description: "Return structured client insights with health prediction, activity summary, and recommended actions.",
              parameters: {
                type: "object",
                properties: {
                  health_prediction: {
                    type: "object",
                    properties: {
                      score: { type: "number", description: "Predicted health score 0-100" },
                      trend: { type: "string", enum: ["improving", "stable", "declining"] },
                      summary: { type: "string", description: "One-sentence health prediction" },
                    },
                    required: ["score", "trend", "summary"],
                  },
                  activity_summary: {
                    type: "string",
                    description: "2-3 sentence summary of recent client activity and engagement patterns",
                  },
                  recommended_actions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        action: { type: "string", description: "Specific action to take" },
                        priority: { type: "string", enum: ["high", "medium", "low"] },
                        reason: { type: "string", description: "Why this action matters" },
                      },
                      required: ["action", "priority", "reason"],
                    },
                    description: "3-5 recommended actions sorted by priority",
                  },
                  risk_flags: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of risk factors (empty if none)",
                  },
                },
                required: ["health_prediction", "activity_summary", "recommended_actions", "risk_flags"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_insights" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in Settings." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in AI response");

    const insights = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(insights), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("client-ai-insights error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

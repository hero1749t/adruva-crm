import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authError } = await adminClient.auth.getUser(token);

    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .single();

    if (!callerProfile || callerProfile.role !== "owner") {
      return new Response(JSON.stringify({ error: "Only owners can delete team members" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userId, reassignTo } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: "Missing userId" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (userId === caller.id) {
      return new Response(JSON.stringify({ error: "Cannot delete yourself" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: targetProfile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (targetProfile?.role === "owner") {
      return new Response(JSON.stringify({ error: "Cannot delete an owner" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Reassign or nullify active leads, clients, tasks
    if (reassignTo) {
      // Verify reassignTo user exists and is active
      const { data: reassignProfile } = await adminClient
        .from("profiles")
        .select("id, status")
        .eq("id", reassignTo)
        .single();

      if (!reassignProfile || reassignProfile.status !== "active") {
        return new Response(JSON.stringify({ error: "Reassignment target is not an active team member" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Reassign active leads (not won/lost)
      await adminClient.from("leads").update({ assigned_to: reassignTo })
        .eq("assigned_to", userId)
        .not("status", "in", '("lead_won","lead_lost")');

      // Reassign active clients
      await adminClient.from("clients").update({ assigned_manager: reassignTo })
        .eq("assigned_manager", userId)
        .eq("status", "active");

      // Reassign pending/in_progress tasks
      await adminClient.from("tasks").update({ assigned_to: reassignTo })
        .eq("assigned_to", userId)
        .in("status", ["pending", "in_progress"]);

      // Nullify remaining (completed/lost leads, completed tasks, etc.)
      await adminClient.from("leads").update({ assigned_to: null }).eq("assigned_to", userId);
      await adminClient.from("tasks").update({ assigned_to: null }).eq("assigned_to", userId);
      await adminClient.from("clients").update({ assigned_manager: null }).eq("assigned_manager", userId);
    } else {
      // Nullify all
      await adminClient.from("leads").update({ assigned_to: null }).eq("assigned_to", userId);
      await adminClient.from("tasks").update({ assigned_to: null }).eq("assigned_to", userId);
      await adminClient.from("clients").update({ assigned_manager: null }).eq("assigned_manager", userId);
    }

    await adminClient.from("activity_logs").update({ user_id: null }).eq("user_id", userId);
    await adminClient.from("notifications").delete().eq("user_id", userId);
    await adminClient.from("lead_activities").delete().eq("created_by", userId);

    const { error } = await adminClient.auth.admin.deleteUser(userId);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ message: "User deleted", reassignedTo: reassignTo || null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

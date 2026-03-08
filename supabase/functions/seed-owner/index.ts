import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const email = "owner@adruva.com";
  const password = "Owner@12345";

  // Check if user already exists
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const exists = existingUsers?.users?.some((u) => u.email === email);

  if (exists) {
    return new Response(JSON.stringify({ message: "Owner account already exists" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Create user with owner role in metadata
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: "Adruva Owner", role: "owner" },
  });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ message: "Owner created", userId: data.user.id }), {
    headers: { "Content-Type": "application/json" },
  });
});

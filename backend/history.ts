import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json();
    const session_id = body?.session_id;

    if (!isUuid(session_id)) {
      return json({ error: "Invalid session_id" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing Supabase server environment variables.");
      return json({ error: "Server configuration error" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: votes, error } = await supabase
      .from("votes")
      .select(
        "winner",
      )
      .eq("session_id", session_id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("History lookup failed:", error);
      return json({ error: "Could not load vote history" }, 500);
    }

    return json({
      ok: true,
      votes: votes ?? [],
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return json({ error: "Invalid request" }, 400);
  }
});

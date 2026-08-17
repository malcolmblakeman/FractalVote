import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RULE_RE = /^[12]{16}$/;

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
    const round_id = body?.round_id;
    const winner = body?.winner;

    if (!isUuid(session_id)) {
      return json({ error: "Invalid session_id" }, 400);
    }

    if (!isUuid(round_id)) {
      return json({ error: "Invalid round_id" }, 400);
    }

    if (typeof winner !== "string" || !RULE_RE.test(winner)) {
      return json({ error: "Invalid winner" }, 400);
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

    // Get the authoritative four rules for this round.
    const { data: round, error: roundError } = await supabase
      .from("rounds")
      .select("id, rule_1, rule_2, rule_3, rule_4")
      .eq("id", round_id)
      .maybeSingle();

    if (roundError) {
      console.error("Round lookup failed:", roundError);
      return json({ error: "Could not verify round" }, 500);
    }

    if (!round) {
      return json({ error: "Round not found" }, 404);
    }

    const rules = [
      round.rule_1,
      round.rule_2,
      round.rule_3,
      round.rule_4,
    ];

    // The server determines whether the winner was actually displayed.
    if (!rules.includes(winner)) {
      return json(
        { error: "Winner was not part of this round" },
        400,
      );
    }

    // Preserve the exact four rules that belonged to the round.
    const { error: insertError } = await supabase
      .from("votes")
      .insert({
        session_id,
        round_id,
        rule_1: round.rule_1,
        rule_2: round.rule_2,
        rule_3: round.rule_3,
        rule_4: round.rule_4,
        winner,
      });

    if (insertError) {
      // PostgreSQL unique_violation = 23505.
      if (insertError.code === "23505") {
        return json(
          { error: "You have already voted in this round" },
          409,
        );
      }

      console.error("Vote insert failed:", insertError);
      return json({ error: "Could not save vote" }, 500);
    }

    return json({
      ok: true,
      round_id,
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return json({ error: "Invalid request" }, 400);
  }
});

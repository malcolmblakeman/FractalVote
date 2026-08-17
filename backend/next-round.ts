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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing Supabase server environment variables.");
      return json({ error: "Server configuration error" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Ask Postgres for four random rules.
    const { data: selectedRules, error: rulesError } = await supabase
      .rpc("get_random_rules");

    if (rulesError) {
      console.error("Rule selection failed:", rulesError);
      return json({ error: "Could not select rules" }, 500);
    }

    if (!Array.isArray(selectedRules) || selectedRules.length !== 4) {
      console.error("Unexpected rule selection:", selectedRules);
      return json({ error: "Could not select four rules" }, 500);
    }

    const ruleStrings = selectedRules.map((row) => row.rule);

    // Create the authoritative round record.
    const { data: round, error: roundError } = await supabase
      .from("rounds")
      .insert({
        rule_1: ruleStrings[0],
        rule_2: ruleStrings[1],
        rule_3: ruleStrings[2],
        rule_4: ruleStrings[3],
      })
      .select("id, rule_1, rule_2, rule_3, rule_4")
      .single();

    if (roundError || !round) {
      console.error("Round creation failed:", roundError);
      return json({ error: "Could not create round" }, 500);
    }

    return json({
      round_id: round.id,
      rules: [
        round.rule_1,
        round.rule_2,
        round.rule_3,
        round.rule_4,
      ],
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return json({ error: "Unexpected server error" }, 500);
  }
});

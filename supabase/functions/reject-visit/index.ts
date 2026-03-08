import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (!id) return new Response("ID inválido", { status: 400 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const { error } = await supabase
    .from("visitas")
    .update({ status: "rejeitado" })
    .eq("id", id);

  if (error) return new Response("Erro: " + error.message, { status: 500 });

  const redirectUrl = "https://dasksz.github.io/DASHBOARD-PROMOTORES/reject-visit.html";

  return new Response(null, {
    status: 303,
    headers: {
      ...corsHeaders,
      "Location": redirectUrl,
    },
  });
});

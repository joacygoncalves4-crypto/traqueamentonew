import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const {
      campanha_id,
      fbclid,
      fbc,
      fbp,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_content,
      utm_term,
      landing_url,
    } = body;

    if (!campanha_id) {
      return new Response(
        JSON.stringify({ error: "campanha_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Captura IP real server-side (passa pelos proxies do EasyPanel/Traefik)
    const xff = req.headers.get("x-forwarded-for") || "";
    const ip_address = xff.split(",")[0].trim() || req.headers.get("x-real-ip") || null;

    // Captura User-Agent server-side (mais confiável que do JS)
    const user_agent = req.headers.get("user-agent") || null;

    // Gera click_id UUID server-side
    const click_id = crypto.randomUUID();

    const { data, error } = await supabase
      .from("cliques")
      .insert({
        click_id,
        campanha_id,
        fbclid: fbclid || null,
        fbc: fbc || null,
        fbp: fbp || null,
        utm_source: utm_source || null,
        utm_medium: utm_medium || null,
        utm_campaign: utm_campaign || null,
        utm_content: utm_content || null,
        utm_term: utm_term || null,
        user_agent,
        landing_url: landing_url || null,
        ip_address,
        status: "pending",
      })
      .select("id, click_id")
      .single();

    if (error) {
      console.error("Erro ao salvar clique:", error);
      return new Response(
        JSON.stringify({ error: "Erro ao salvar clique", details: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Clique salvo: click_id=${click_id} ip=${ip_address} campanha=${campanha_id}`);

    return new Response(
      JSON.stringify({ success: true, click_id: data.click_id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro na track-click:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

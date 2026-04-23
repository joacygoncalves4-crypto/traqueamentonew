import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sha256(message: string): Promise<string> {
  // Normaliza igual ao WhatsApp: trim + lowercase + remove espacos
  const normalized = message.trim().toLowerCase().replace(/\s/g, "");
  const msgBuffer = new TextEncoder().encode(normalized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload = await req.json();
    console.log("Telegram webhook recebido:", JSON.stringify(payload, null, 2));

    // Telegram envia chat_member updates quando alguém entra
    const chatMember = payload.chat_member;
    if (!chatMember) {
      console.log("Evento ignorado (não é chat_member)");
      return new Response(JSON.stringify({ ok: true, message: "Evento ignorado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verificar se é entrada (new_chat_member com status "member")
    const newStatus = chatMember.new_chat_member?.status;
    if (newStatus !== "member") {
      console.log("Status ignorado:", newStatus);
      return new Response(JSON.stringify({ ok: true, message: "Status ignorado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const chatId = String(chatMember.chat?.id || "");
    const userId = String(chatMember.new_chat_member?.user?.id || "");
    const userName = chatMember.new_chat_member?.user?.first_name || "Desconhecido";

    console.log("Entrada Telegram detectada:", { chatId, userId, userName });

    if (!chatId || !userId) {
      return new Response(JSON.stringify({ error: "Dados insuficientes" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Buscar campanha pelo telegram_chat_id
    const { data: campanha, error: campanhaError } = await supabase
      .from("campanhas")
      .select("id, nome, grupo_id, telegram_chat_id, pixel_id")
      .eq("telegram_chat_id", chatId)
      .eq("ativo", true)
      .maybeSingle();

    if (campanhaError) {
      console.error("Erro ao buscar campanha:", campanhaError);
    }

    if (!campanha) {
      console.log("Campanha não encontrada para chat_id:", chatId);
      return new Response(
        JSON.stringify({ ok: true, message: "Campanha não encontrada", chatId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Campanha encontrada:", campanha.nome);

    // Buscar Pixel
    let pixelId = null;
    let accessToken = null;
    let pixelDbId = null;
    let testEventCode: string | null = null;

    if (campanha.pixel_id) {
      const { data: pixelData } = await supabase
        .from("pixels")
        .select("id, pixel_id, access_token, ativo, test_event_code")
        .eq("id", campanha.pixel_id)
        .eq("ativo", true)
        .maybeSingle();

      if (pixelData) {
        pixelId = pixelData.pixel_id;
        accessToken = pixelData.access_token;
        pixelDbId = pixelData.id;
        testEventCode = pixelData.test_event_code;
        console.log("Pixel encontrado:", pixelId);
      }
    }

    // Hash do user_id do Telegram como identificador unico
    const userIdHash = await sha256(userId);
    const userIdMasked = `tg_${userId.slice(0, 4)}****`;

    // --- FIFO MATCH com janela de 5 minutos (igual ao WhatsApp) ---
    // Expirar cliques antigos desta campanha
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    await supabase
      .from("cliques")
      .update({ status: "expired" })
      .eq("campanha_id", campanha.id)
      .eq("status", "pending")
      .lt("created_at", fiveMinAgo);

    // Busca o clique pendente mais antigo (FIFO) na janela de 5 min
    const { data: clickData } = await supabase
      .from("cliques")
      .select("id, click_id, fbclid, fbc, fbp, utm_source, utm_medium, utm_campaign, utm_content, user_agent, landing_url, ip_address")
      .eq("campanha_id", campanha.id)
      .eq("status", "pending")
      .gte("created_at", fiveMinAgo)
      .order("created_at", { ascending: true }) // FIFO: mais antigo primeiro
      .limit(1)
      .maybeSingle();

    if (!clickData) {
      console.log(`Sem clique pendente válido para campanha ${campanha.nome} — salvando sem atribuição`);
      // Salva no banco como log interno sem enviar ao Facebook
      await supabase.from("eventos").insert({
        campanha_id: campanha.id,
        telefone_hash: userIdHash,
        telefone_masked: userIdMasked,
        evento_enviado: false,
        pixel_response: "match_falhou_sem_clique_pendente",
        pixel_id: pixelDbId,
        fonte: "telegram",
      });

      return new Response(
        JSON.stringify({ ok: true, campaign: campanha.nome, user: userIdMasked, pixel_sent: false, reason: "sem_clique_pendente" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Clique FIFO encontrado:", { click_id: clickData.click_id, fbc: clickData.fbc });

    let eventoEnviado = false;
    let pixelResponse = null;
    let insertedEventoId = null;

    // Enviar evento para Facebook CAPI (Graph API v21.0)
    if (pixelId && accessToken) {
      try {
        const eventTime = Math.floor(Date.now() / 1000);
        // Usa click_id como event_id para deduplicação estável
        const eventId = clickData.click_id || `tg_${userId}_${eventTime}`;
        const countryHash = await sha256("br");

        // Monta user_data com todos os campos disponíveis
        const user_data: any = {
          external_id: [userIdHash],
          country: [countryHash],
        };
        if (clickData.fbc) user_data.fbc = clickData.fbc;
        if (clickData.fbp) user_data.fbp = clickData.fbp;
        if (clickData.user_agent) user_data.client_user_agent = clickData.user_agent;
        if (clickData.ip_address) user_data.client_ip_address = clickData.ip_address;

        const eventData: any = {
          event_name: "Lead",  // Standard event (não custom) para otimização
          event_time: eventTime,
          event_id: eventId,
          action_source: "website",
          user_data,
          custom_data: {
            lead_type: "grupo_telegram",        // Filtro da conversão personalizada
            lead_source: "grupo_direto",
            campaign_id: campanha.grupo_id,
            campaign_name: campanha.nome,
            chat_id: chatId,
            user_name: userName,
          },
        };

        if (clickData.landing_url) eventData.event_source_url = clickData.landing_url;
        if (clickData.utm_campaign) eventData.custom_data.utm_campaign = clickData.utm_campaign;
        if (clickData.utm_source) eventData.custom_data.utm_source = clickData.utm_source;
        if (clickData.utm_medium) eventData.custom_data.utm_medium = clickData.utm_medium;
        if (clickData.utm_content) eventData.custom_data.utm_content = clickData.utm_content;

        const facebookPayload = {
          data: [eventData],
          ...(testEventCode && { test_event_code: testEventCode }),
        };

        console.log("Enviando Telegram para Facebook CAPI v21.0:", JSON.stringify(facebookPayload, null, 2));

        const fbResponse = await fetch(
          `https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${accessToken}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(facebookPayload),
          }
        );

        const fbData = await fbResponse.json();
        console.log("Resposta Facebook:", JSON.stringify(fbData, null, 2));

        if (fbResponse.ok && fbData.events_received) {
          eventoEnviado = true;
        }
        pixelResponse = JSON.stringify(fbData);
      } catch (fbError) {
        console.error("Erro ao enviar para Facebook:", fbError);
        pixelResponse = String(fbError);
      }
    }

    // Salvar evento no banco
    const { data: insertedEvento, error: insertError } = await supabase
      .from("eventos")
      .insert({
        campanha_id: campanha.id,
        telefone_hash: userIdHash,
        telefone_masked: userIdMasked,
        evento_enviado: eventoEnviado,
        pixel_response: pixelResponse,
        pixel_id: pixelDbId,
        fonte: "telegram",
        fbclid: clickData.fbclid || null,
        fbc: clickData.fbc || null,
        fbp: clickData.fbp || null,
        utm_campaign: clickData.utm_campaign || null,
        user_agent: clickData.user_agent || null,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Erro ao salvar evento:", insertError);
    } else {
      insertedEventoId = insertedEvento?.id;
      console.log("Evento Telegram salvo:", insertedEventoId);
    }

    // Marcar clique como matched (FIFO)
    if (insertedEventoId) {
      await supabase
        .from("cliques")
        .update({
          status: "matched",
          matched_evento_id: insertedEventoId,
          matched_at: new Date().toISOString(),
        })
        .eq("id", clickData.id);

      console.log(`Clique ${clickData.click_id} marcado como matched`);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        campaign: campanha.nome,
        user: userIdMasked,
        pixel_sent: eventoEnviado,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro no webhook Telegram:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

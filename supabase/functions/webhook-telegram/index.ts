import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
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

    const url = new URL(req.url);
    const botId = url.searchParams.get("bot_id");

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

    console.log("Entrada detectada:", { chatId, userId, userName });

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

    // Hash do user_id do Telegram (como identificador)
    const userIdHash = await sha256(userId);
    const userIdMasked = `tg_${userId.slice(0, 4)}****`;

    let eventoEnviado = false;
    let pixelResponse = null;

    // Enviar evento para Facebook CAPI
    if (pixelId && accessToken) {
      try {
        const eventTime = Math.floor(Date.now() / 1000);
        const eventId = `tg_${userId}_${eventTime}`;
        const countryHash = await sha256("br");

        const facebookPayload = {
          data: [
            {
              event_name: "GrupoEntrada",
              event_time: eventTime,
              event_id: eventId,
              action_source: "website",
              user_data: {
                external_id: [userIdHash],
                country: [countryHash],
              },
              custom_data: {
                source: "telegram",
                campaign_id: campanha.grupo_id,
                campaign_name: campanha.nome,
                chat_id: chatId,
                user_name: userName,
              },
            },
          ],
          ...(testEventCode && { test_event_code: testEventCode }),
        };

        console.log("Enviando para Facebook:", JSON.stringify(facebookPayload, null, 2));

        const fbResponse = await fetch(
          `https://graph.facebook.com/v18.0/${pixelId}/events?access_token=${accessToken}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(facebookPayload),
          }
        );

        const fbData = await fbResponse.json();
        console.log("Resposta do Facebook:", JSON.stringify(fbData, null, 2));

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
    const { error: insertError } = await supabase.from("eventos").insert({
      campanha_id: campanha.id,
      telefone_hash: userIdHash,
      telefone_masked: userIdMasked,
      evento_enviado: eventoEnviado,
      pixel_response: pixelResponse,
      pixel_id: pixelDbId,
      fonte: "telegram",
    });

    if (insertError) {
      console.error("Erro ao salvar evento:", insertError);
    } else {
      console.log("Evento Telegram salvo com sucesso!");
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

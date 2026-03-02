import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function hashPhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return "***";
  return `${digits.slice(0, 4)}****${digits.slice(-2)}`;
}

// ========== MENSAGEM RECEBIDA HANDLER ==========
async function handleMessageUpsert(payload: any, supabase: any) {
  const data = payload.data || payload;
  
  // Extract message info - Evolution API v2 format
  const key = data.key || {};
  const message = data.message || {};
  const remoteJid = key.remoteJid || "";
  const fromMe = key.fromMe || false;
  const instanceName = payload.instance || payload.instanceName || "";

  // Ignore messages sent by us
  if (fromMe) {
    console.log("Mensagem enviada por nós, ignorando");
    return { message: "Mensagem própria ignorada" };
  }

  // Extract message text from various possible fields
  const messageText = message.conversation 
    || message.extendedTextMessage?.text 
    || message.imageMessage?.caption 
    || message.videoMessage?.caption 
    || "";

  if (!messageText) {
    console.log("Mensagem sem texto, ignorando");
    return { message: "Mensagem sem texto ignorada" };
  }

  console.log("Mensagem recebida:", { instanceName, remoteJid, messageText: messageText.substring(0, 50) });

  // Extract sender phone
  const senderPhone = remoteJid.replace(/@.*$/, "").replace(/\D/g, "");
  if (!senderPhone) {
    console.log("Remetente sem telefone identificável");
    return { message: "Remetente inválido" };
  }

  // Search for matching keyword triggers (case-insensitive contains)
  const { data: gatilhos, error: gatilhoError } = await supabase
    .from("mensagem_gatilhos")
    .select("id, nome, instance_name, keyword, pixel_id")
    .eq("ativo", true);

  if (gatilhoError) {
    console.error("Erro ao buscar gatilhos:", gatilhoError);
    return { error: "Erro ao buscar gatilhos" };
  }

  // Filter: match instance_name AND keyword contains (case-insensitive)
  const textLower = messageText.toLowerCase();
  const matchedGatilhos = (gatilhos || []).filter((g: any) => {
    const instanceMatch = g.instance_name.toLowerCase() === instanceName.toLowerCase();
    const keywordMatch = textLower.includes(g.keyword.toLowerCase());
    return instanceMatch && keywordMatch;
  });

  if (matchedGatilhos.length === 0) {
    console.log("Nenhum gatilho correspondente encontrado");
    return { message: "Sem gatilho correspondente" };
  }

  const results = [];

  for (const gatilho of matchedGatilhos) {
    console.log("Gatilho encontrado:", gatilho.nome, "keyword:", gatilho.keyword);

    let eventoEnviado = false;
    let pixelResponse = null;
    let pixelDbId = null;

    // Get pixel if configured
    if (gatilho.pixel_id) {
      const { data: pixelData } = await supabase
        .from("pixels")
        .select("id, pixel_id, access_token, ativo, test_event_code")
        .eq("id", gatilho.pixel_id)
        .eq("ativo", true)
        .maybeSingle();

      if (pixelData) {
        pixelDbId = pixelData.id;
        try {
          const eventTime = Math.floor(Date.now() / 1000);
          const eventId = `msg_${senderPhone}_${eventTime}`;
          const phoneHash = await sha256(senderPhone);
          const countryHash = await sha256("br");

          const facebookPayload: any = {
            data: [{
              event_name: "MensagemRecebida",
              event_time: eventTime,
              event_id: eventId,
              action_source: "website",
              user_data: {
                ph: [phoneHash],
                country: [countryHash],
              },
              custom_data: {
                source: "mensagem",
                trigger_name: gatilho.nome,
                keyword: gatilho.keyword,
                instance_name: gatilho.instance_name,
              },
            }],
            ...(pixelData.test_event_code && { test_event_code: pixelData.test_event_code }),
          };

          console.log("Enviando MensagemRecebida para Facebook:", JSON.stringify(facebookPayload, null, 2));

          const fbResponse = await fetch(
            `https://graph.facebook.com/v18.0/${pixelData.pixel_id}/events?access_token=${pixelData.access_token}`,
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
    }

    // Save event - use gatilho.id as campanha_id reference isn't ideal,
    // but we need a campanha_id. We'll create a pseudo-entry using the gatilho name.
    // Actually, eventos requires campanha_id (FK). We'll save without campanha_id won't work.
    // Let's save with telefone info directly.
    const { error: insertError } = await supabase.from("eventos").insert({
      campanha_id: null,
      gatilho_id: gatilho.id,
      telefone_hash: hashPhone(senderPhone),
      telefone_masked: maskPhone(senderPhone),
      evento_enviado: eventoEnviado,
      pixel_response: pixelResponse,
      pixel_id: pixelDbId,
      fonte: "mensagem",
    });

    if (insertError) {
      console.error("Erro ao salvar evento de mensagem:", insertError);
    } else {
      console.log("Evento de mensagem salvo com sucesso!");
    }

    results.push({
      trigger: gatilho.nome,
      keyword: gatilho.keyword,
      phone: maskPhone(senderPhone),
      pixel_sent: eventoEnviado,
    });
  }

  return { success: true, triggers_matched: results.length, results };
}

// ========== GROUP PARTICIPANTS HANDLER ==========
async function handleGroupParticipantsUpdate(payload: any, supabase: any) {
  const data = payload.data || payload;
  
  const action = data.action || "";
  if (action !== "add") {
    console.log("Ação ignorada:", action);
    return { message: "Ação ignorada", action };
  }

  const groupJid = data.jid || data.groupJid || data.remoteJid || data.id || "";
  console.log("JID do grupo:", groupJid);

  const participants = Array.isArray(data.participants) 
    ? data.participants 
    : data.participant 
      ? [data.participant] 
      : [];

  if (participants.length === 0) {
    console.error("Nenhum participante encontrado no payload");
    return { error: "Participantes não encontrados" };
  }

  console.log("Participantes:", participants);
  
  const { data: campanha, error: campanhaError } = await supabase
    .from("campanhas")
    .select("id, nome, grupo_id, whatsapp_group_jid, pixel_id")
    .eq("whatsapp_group_jid", groupJid)
    .eq("ativo", true)
    .maybeSingle();

  if (campanhaError) {
    console.error("Erro ao buscar campanha:", campanhaError);
  }

  if (!campanha) {
    console.log("Campanha não encontrada para o JID:", groupJid);
    return { message: "Campanha não encontrada", groupJid };
  }

  console.log("Campanha encontrada:", campanha.nome);

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
    }
  }

  const results = [];

  for (const participant of participants) {
    let phoneRaw: string;
    if (typeof participant === 'string') {
      phoneRaw = participant;
    } else if (participant.phoneNumber) {
      phoneRaw = typeof participant.phoneNumber === 'string' 
        ? participant.phoneNumber 
        : String(participant.phoneNumber);
    } else if (participant.id) {
      phoneRaw = participant.id;
    } else {
      continue;
    }
    
    const phone = phoneRaw.replace(/@.*$/, "").replace(/\D/g, "");
    if (!phone) continue;

    let eventoEnviado = false;
    let pixelResponse = null;

    if (pixelId && accessToken) {
      try {
        const eventTime = Math.floor(Date.now() / 1000);
        const eventId = `grp_${phone}_${eventTime}`;
        const phoneHash = await sha256(phone);
        const countryHash = await sha256("br");

        const facebookPayload: any = {
          data: [{
            event_name: "GrupoEntrada",
            event_time: eventTime,
            event_id: eventId,
            action_source: "website",
            user_data: {
              ph: [phoneHash],
              country: [countryHash],
            },
            custom_data: {
              campaign_id: campanha.grupo_id,
              campaign_name: campanha.nome,
              group_jid: groupJid,
            },
          }],
          ...(testEventCode && { test_event_code: testEventCode }),
        };

        const fbResponse = await fetch(
          `https://graph.facebook.com/v18.0/${pixelId}/events?access_token=${accessToken}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(facebookPayload),
          }
        );

        const fbData = await fbResponse.json();
        if (fbResponse.ok && fbData.events_received) {
          eventoEnviado = true;
          pixelResponse = JSON.stringify(fbData);
        } else {
          pixelResponse = JSON.stringify(fbData);
        }
      } catch (fbError) {
        console.error("Erro ao enviar para Facebook:", fbError);
        pixelResponse = String(fbError);
      }
    }

    const { error: insertError } = await supabase.from("eventos").insert({
      campanha_id: campanha.id,
      telefone_hash: hashPhone(phone),
      telefone_masked: maskPhone(phone),
      evento_enviado: eventoEnviado,
      pixel_response: pixelResponse,
      pixel_id: pixelDbId,
    });

    if (insertError) {
      console.error("Erro ao salvar evento:", insertError);
    }

    results.push({ phone: maskPhone(phone), pixel_sent: eventoEnviado });
  }

  return {
    success: true,
    campaign: campanha.nome,
    participants_processed: results.length,
    results,
  };
}

// ========== MAIN HANDLER ==========
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload = await req.json();
    console.log("Webhook recebido:", JSON.stringify(payload, null, 2));

    const event = payload.event || payload.type;

    let result;

    if (event === "MESSAGES_UPSERT" || event === "messages.upsert") {
      result = await handleMessageUpsert(payload, supabase);
    } else if (event === "GROUP_PARTICIPANTS_UPDATE" || event === "group-participants.update") {
      result = await handleGroupParticipantsUpdate(payload, supabase);
    } else {
      console.log("Evento ignorado:", event);
      result = { message: "Evento ignorado", event };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro no webhook:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

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

        // Busca dados de atribuicao do clique mais recente (qualquer campanha)
        // para mensagens diretas, tentamos encontrar pelo telefone na tabela cliques
        let msgAttr: any = {};
        try {
          const { data: clickData } = await supabase
            .from("cliques")
            .select("fbclid, fbc, fbp, utm_source, utm_medium, utm_campaign, utm_content, user_agent, landing_url")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (clickData) msgAttr = clickData;
        } catch (e) {
          console.error("Erro ao buscar atribuicao para mensagem:", e);
        }

        try {
          const eventTime = Math.floor(Date.now() / 1000);
          const eventId = `msg_${senderPhone}_${eventTime}`;
          const phoneHash = await sha256(senderPhone);
          const countryHash = await sha256("br");

          // Monta user_data completo
          const user_data: any = {
            ph: [phoneHash],
            country: [countryHash],
          };
          if (msgAttr.fbc) user_data.fbc = msgAttr.fbc;
          if (msgAttr.fbp) user_data.fbp = msgAttr.fbp;
          if (msgAttr.user_agent) user_data.client_user_agent = msgAttr.user_agent;

          const eventData: any = {
            event_name: "MensagemRecebida",
            event_time: eventTime,
            event_id: eventId,
            action_source: "website",
            user_data,
            custom_data: {
              source: "mensagem",
              trigger_name: gatilho.nome,
              keyword: gatilho.keyword,
              instance_name: gatilho.instance_name,
            },
          };

          if (msgAttr.landing_url) eventData.event_source_url = msgAttr.landing_url;
          if (msgAttr.utm_campaign) eventData.custom_data.utm_campaign = msgAttr.utm_campaign;
          if (msgAttr.utm_source) eventData.custom_data.utm_source = msgAttr.utm_source;

          const facebookPayload: any = {
            data: [eventData],
            ...(pixelData.test_event_code && { test_event_code: pixelData.test_event_code }),
          };

          console.log("Enviando MensagemRecebida para Facebook com atribuicao:", JSON.stringify(facebookPayload, null, 2));

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

  // ==========================================
  // CLEANUP: marca cliques pendentes desta campanha mais velhos que 5min como expired
  // ==========================================
  const FIVE_MIN_MS = 5 * 60 * 1000;
  const fiveMinAgoIso = new Date(Date.now() - FIVE_MIN_MS).toISOString();
  await supabase
    .from("cliques")
    .update({ status: "expired" })
    .eq("campanha_id", campanha.id)
    .eq("status", "pending")
    .lt("created_at", fiveMinAgoIso);

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

    // ==========================================
    // FIFO MATCH: pega o clique pendente MAIS ANTIGO desta campanha
    // dentro da janela de 5 minutos
    // ==========================================
    const { data: clickData } = await supabase
      .from("cliques")
      .select("id, click_id, fbclid, fbc, fbp, utm_source, utm_medium, utm_campaign, utm_content, user_agent, landing_url, ip_address")
      .eq("campanha_id", campanha.id)
      .eq("status", "pending")
      .gte("created_at", fiveMinAgoIso)
      .order("created_at", { ascending: true })  // FIFO: mais antigo primeiro
      .limit(1)
      .maybeSingle();

    // Sem clique pendente válido → NÃO envia ao Facebook (qualidade > volume)
    if (!clickData) {
      console.log(`[FIFO] Sem clique pendente válido para campanha ${campanha.id} — não enviando ao Facebook`);
      await supabase.from("eventos").insert({
        campanha_id: campanha.id,
        telefone_hash: hashPhone(phone),
        telefone_masked: maskPhone(phone),
        evento_enviado: false,
        pixel_response: "match_falhou_sem_clique_pendente",
        pixel_id: pixelDbId,
        fonte: "whatsapp",
      });
      results.push({ phone: maskPhone(phone), pixel_sent: false, reason: "sem_clique_pendente" });
      continue;
    }

    console.log(`[FIFO] Match encontrado: click_id=${clickData.click_id} fbc=${clickData.fbc ? "ok" : "null"} fbp=${clickData.fbp ? "ok" : "null"} ip=${clickData.ip_address ? "ok" : "null"}`);

    let eventoEnviado = false;
    let pixelResponse: string | null = null;

    if (pixelId && accessToken) {
      try {
        const eventTime = Math.floor(Date.now() / 1000);
        const phoneHash = await sha256(phone);
        const countryHash = await sha256("br");

        // user_data ENRIQUECIDO — todos os sinais possíveis pra subir EMQ
        const user_data: any = {
          ph: [phoneHash],
          external_id: [phoneHash],  // ID estável do usuário
          country: [countryHash],
        };
        if (clickData.fbc) user_data.fbc = clickData.fbc;
        if (clickData.fbp) user_data.fbp = clickData.fbp;
        if (clickData.user_agent) user_data.client_user_agent = clickData.user_agent;
        if (clickData.ip_address) user_data.client_ip_address = clickData.ip_address;

        // STANDARD EVENT "Lead" (custom events não otimizam campanhas)
        // event_id = click_id estável → permite dedupe browser+server no futuro
        const eventData: any = {
          event_name: "Lead",
          event_time: eventTime,
          event_id: clickData.click_id,
          action_source: "website",
          user_data,
          custom_data: {
            lead_type: "grupo_whatsapp",
            lead_source: "grupo_direto",
            campaign_id: campanha.grupo_id,
            campaign_name: campanha.nome,
            group_jid: groupJid,
          },
        };

        if (clickData.landing_url) eventData.event_source_url = clickData.landing_url;
        if (clickData.utm_campaign) eventData.custom_data.utm_campaign = clickData.utm_campaign;
        if (clickData.utm_source) eventData.custom_data.utm_source = clickData.utm_source;
        if (clickData.utm_medium) eventData.custom_data.utm_medium = clickData.utm_medium;
        if (clickData.utm_content) eventData.custom_data.utm_content = clickData.utm_content;

        const facebookPayload: any = {
          data: [eventData],
          ...(testEventCode && { test_event_code: testEventCode }),
        };

        console.log("Enviando Lead para Facebook:", JSON.stringify(facebookPayload, null, 2));

        const fbResponse = await fetch(
          `https://graph.facebook.com/v18.0/${pixelId}/events?access_token=${accessToken}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(facebookPayload),
          }
        );

        const fbData = await fbResponse.json();
        pixelResponse = JSON.stringify(fbData);
        if (fbResponse.ok && fbData.events_received) {
          eventoEnviado = true;
        }
      } catch (fbError) {
        console.error("Erro ao enviar para Facebook:", fbError);
        pixelResponse = String(fbError);
      }
    }

    // Insere o evento e captura o ID pra ligar com o clique
    const { data: insertedEvento, error: insertError } = await supabase
      .from("eventos")
      .insert({
        campanha_id: campanha.id,
        telefone_hash: hashPhone(phone),
        telefone_masked: maskPhone(phone),
        evento_enviado: eventoEnviado,
        pixel_response: pixelResponse,
        pixel_id: pixelDbId,
        fonte: "whatsapp",
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
    }

    // Marca o clique como matched (não pode ser reutilizado)
    if (insertedEvento) {
      await supabase
        .from("cliques")
        .update({
          status: "matched",
          matched_evento_id: insertedEvento.id,
          matched_at: new Date().toISOString(),
        })
        .eq("id", clickData.id);
    }

    results.push({ phone: maskPhone(phone), pixel_sent: eventoEnviado, click_id: clickData.click_id });
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

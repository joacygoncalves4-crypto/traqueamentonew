import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Função para criar hash do telefone
function hashPhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

// Função para mascarar telefone
function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return "***";
  return `${digits.slice(0, 4)}****${digits.slice(-2)}`;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload = await req.json();
    console.log("Webhook recebido:", JSON.stringify(payload, null, 2));

    // Evolution API v2 - Evento GROUP_PARTICIPANTS_UPDATE
    // Formato: { event: "GROUP_PARTICIPANTS_UPDATE", data: { jid: "120363...@g.us", action: "add", participants: ["5511...@s.whatsapp.net"] } }
    const event = payload.event || payload.type;
    
    // Verificar se é evento de atualização de participantes do grupo
    if (event !== "GROUP_PARTICIPANTS_UPDATE" && event !== "group-participants.update") {
      console.log("Evento ignorado:", event);
      return new Response(JSON.stringify({ message: "Evento ignorado", event }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = payload.data || payload;
    
    // Verificar se é ação de adição (ignorar remove, promote, demote)
    const action = data.action || "";
    if (action !== "add") {
      console.log("Ação ignorada:", action);
      return new Response(JSON.stringify({ message: "Ação ignorada", action }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extrair JID do grupo (formato: 120363...@g.us)
    const groupJid = data.jid || data.groupJid || data.remoteJid || "";
    console.log("JID do grupo:", groupJid);

    // Extrair participantes (pode ser array ou string)
    const participants = Array.isArray(data.participants) 
      ? data.participants 
      : data.participant 
        ? [data.participant] 
        : [];

    if (participants.length === 0) {
      console.error("Nenhum participante encontrado no payload");
      return new Response(JSON.stringify({ error: "Participantes não encontrados" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Participantes:", participants);
    
    // Buscar campanha pelo JID do grupo WhatsApp
    const { data: campanha, error: campanhaError } = await supabase
      .from("campanhas")
      .select("id, nome, grupo_id, whatsapp_group_jid")
      .eq("whatsapp_group_jid", groupJid)
      .eq("ativo", true)
      .maybeSingle();

    if (campanhaError) {
      console.error("Erro ao buscar campanha:", campanhaError);
    }

    if (!campanha) {
      console.log("Campanha não encontrada para o JID:", groupJid);
      return new Response(
        JSON.stringify({ 
          message: "Campanha não encontrada", 
          groupJid,
          hint: "Cadastre o JID do grupo na campanha" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Campanha encontrada:", campanha.nome);

    // Buscar configurações do Pixel
    const { data: config } = await supabase
      .from("configuracoes")
      .select("pixel_id, access_token")
      .limit(1)
      .maybeSingle();

    const pixelId = config?.pixel_id;
    const accessToken = config?.access_token;

    const results = [];

    // Processar cada participante
    for (const participant of participants) {
      const phone = participant.replace(/@.*$/, "").replace(/\D/g, "");
      
      if (!phone) {
        console.log("Número inválido ignorado:", participant);
        continue;
      }

      console.log("Processando entrada:", { phone, campanha: campanha.nome });

      let eventoEnviado = false;
      let pixelResponse = null;

      // Enviar evento para Facebook Conversions API
      if (pixelId && accessToken) {
        try {
          const eventTime = Math.floor(Date.now() / 1000);
          const eventId = `grp_${phone}_${eventTime}`;

          const facebookPayload = {
            data: [
              {
                event_name: "GrupoEntrada",
                event_time: eventTime,
                event_id: eventId,
                action_source: "website",
                user_data: {
                  ph: [phone],
                  country: ["br"],
                },
                custom_data: {
                  campaign_id: campanha.grupo_id,
                  campaign_name: campanha.nome,
                  group_jid: groupJid,
                },
              },
            ],
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
            pixelResponse = JSON.stringify(fbData);
          } else {
            pixelResponse = JSON.stringify(fbData);
          }
        } catch (fbError) {
          console.error("Erro ao enviar para Facebook:", fbError);
          pixelResponse = String(fbError);
        }
      } else {
        console.log("Pixel não configurado - evento não enviado ao Facebook");
      }

      // Salvar evento no banco de dados
      const { error: insertError } = await supabase.from("eventos").insert({
        campanha_id: campanha.id,
        telefone_hash: hashPhone(phone),
        telefone_masked: maskPhone(phone),
        evento_enviado: eventoEnviado,
        pixel_response: pixelResponse,
      });

      if (insertError) {
        console.error("Erro ao salvar evento:", insertError);
      } else {
        console.log("Evento salvo com sucesso!");
      }

      results.push({
        phone: maskPhone(phone),
        pixel_sent: eventoEnviado,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        campaign: campanha.nome,
        participants_processed: results.length,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Erro no webhook:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

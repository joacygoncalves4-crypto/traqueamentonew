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

    // Evolution API envia diferentes formatos dependendo da versão
    // Formato esperado: { event: "GROUP_PARTICIPANT.ADD", data: { participant: "5511999999999@s.whatsapp.net", groupId: "..." } }
    const event = payload.event || payload.type;
    
    // Verificar se é evento de entrada no grupo
    if (event !== "GROUP_PARTICIPANT.ADD" && event !== "group-participant.add") {
      console.log("Evento ignorado:", event);
      return new Response(JSON.stringify({ message: "Evento ignorado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = payload.data || payload;
    
    // Extrair número de telefone (pode vir em diferentes formatos)
    const participant = data.participant || data.phoneNumber || data.number || "";
    const phone = participant.replace(/@.*$/, "").replace(/\D/g, "");
    
    if (!phone) {
      console.error("Número de telefone não encontrado no payload");
      return new Response(JSON.stringify({ error: "Número não encontrado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extrair ID do grupo
    const groupId = data.groupId || data.remoteJid || data.jid || "";
    const cleanGroupId = groupId.replace(/@.*$/, "");
    
    console.log("Processando entrada:", { phone, groupId: cleanGroupId });

    // Buscar campanha pelo grupo_id ou pelo ID do grupo do WhatsApp
    const { data: campanha, error: campanhaError } = await supabase
      .from("campanhas")
      .select("id, nome, grupo_id")
      .or(`grupo_id.eq.${cleanGroupId},link_grupo.ilike.%${cleanGroupId}%`)
      .eq("ativo", true)
      .maybeSingle();

    if (campanhaError) {
      console.error("Erro ao buscar campanha:", campanhaError);
    }

    if (!campanha) {
      console.log("Campanha não encontrada para o grupo:", cleanGroupId);
      // Ainda registra o evento, mas sem campanha vinculada
    }

    // Buscar configurações do Pixel
    const { data: config } = await supabase
      .from("configuracoes")
      .select("pixel_id, access_token")
      .limit(1)
      .single();

    const pixelId = config?.pixel_id;
    const accessToken = config?.access_token;

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
                ph: [phone], // Hash já é feito pelo Facebook
                country: ["br"],
              },
              custom_data: {
                campaign_id: campanha?.grupo_id || cleanGroupId,
                campaign_name: campanha?.nome || "Unknown",
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
    if (campanha) {
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
    }

    return new Response(
      JSON.stringify({
        success: true,
        campaign: campanha?.nome || null,
        pixel_sent: eventoEnviado,
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

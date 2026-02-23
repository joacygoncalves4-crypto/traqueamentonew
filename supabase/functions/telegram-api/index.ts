import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, bot_token, bot_id, nome } = await req.json();

    if (action === "register") {
      if (!bot_token || !nome) {
        return new Response(JSON.stringify({ error: "Token e nome são obrigatórios" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 1. Validar token chamando getMe
      const getMeRes = await fetch(`https://api.telegram.org/bot${bot_token}/getMe`);
      const getMeData = await getMeRes.json();

      if (!getMeData.ok) {
        return new Response(
          JSON.stringify({ success: false, error: "Token inválido. Verifique o token do BotFather." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const botUsername = getMeData.result.username;
      console.log("Bot validado:", botUsername);

      // 2. Salvar no banco
      const { data: botData, error: insertError } = await supabase
        .from("telegram_bots")
        .insert({
          nome,
          bot_token,
          bot_username: botUsername,
          status: "connected",
        })
        .select()
        .single();

      if (insertError) {
        console.error("Erro ao salvar bot:", insertError);
        return new Response(
          JSON.stringify({ success: false, error: "Erro ao salvar bot no banco" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 3. Configurar webhook no Telegram
      const webhookUrl = `${supabaseUrl}/functions/v1/webhook-telegram?bot_id=${botData.id}`;
      const setWebhookRes = await fetch(
        `https://api.telegram.org/bot${bot_token}/setWebhook`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: webhookUrl,
            allowed_updates: ["chat_member"],
          }),
        }
      );

      const webhookData = await setWebhookRes.json();
      console.log("Webhook configurado:", webhookData);

      if (!webhookData.ok) {
        // Remover bot do banco se webhook falhar
        await supabase.from("telegram_bots").delete().eq("id", botData.id);
        return new Response(
          JSON.stringify({ success: false, error: "Erro ao configurar webhook no Telegram" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          bot: {
            id: botData.id,
            nome: botData.nome,
            username: botUsername,
            status: "connected",
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "status") {
      if (!bot_id) {
        return new Response(JSON.stringify({ error: "bot_id é obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: bot } = await supabase
        .from("telegram_bots")
        .select("*")
        .eq("id", bot_id)
        .single();

      if (!bot) {
        return new Response(JSON.stringify({ success: false, error: "Bot não encontrado" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verificar webhook
      const webhookRes = await fetch(
        `https://api.telegram.org/bot${bot.bot_token}/getWebhookInfo`
      );
      const webhookData = await webhookRes.json();

      const isActive = webhookData.ok && webhookData.result?.url?.includes("webhook-telegram");

      // Atualizar status no banco
      const newStatus = isActive ? "connected" : "disconnected";
      await supabase
        .from("telegram_bots")
        .update({ status: newStatus })
        .eq("id", bot_id);

      return new Response(
        JSON.stringify({
          success: true,
          status: newStatus,
          webhook_info: webhookData.result,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "delete") {
      if (!bot_id) {
        return new Response(JSON.stringify({ error: "bot_id é obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: bot } = await supabase
        .from("telegram_bots")
        .select("bot_token")
        .eq("id", bot_id)
        .single();

      if (bot) {
        // Remover webhook do Telegram
        await fetch(`https://api.telegram.org/bot${bot.bot_token}/deleteWebhook`);
      }

      // Remover referências em campanhas
      await supabase
        .from("campanhas")
        .update({ telegram_bot_id: null, telegram_chat_id: null })
        .eq("telegram_bot_id", bot_id);

      // Deletar do banco
      await supabase.from("telegram_bots").delete().eq("id", bot_id);

      return new Response(
        JSON.stringify({ success: true, message: "Bot removido com sucesso" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Ação não reconhecida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro na telegram-api:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EvolutionRequest {
  action: "create" | "connect" | "status" | "groups" | "webhook" | "delete" | "disconnect";
  instance_name: string;
  webhook_url?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get Evolution API credentials from environment
    const api_url = Deno.env.get("EVOLUTION_API_URL");
    const api_key = Deno.env.get("EVOLUTION_API_KEY");

    if (!api_url || !api_key) {
      return new Response(JSON.stringify({
        success: false,
        error: "Evolution API não configurada. Configure EVOLUTION_API_URL e EVOLUTION_API_KEY.",
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: EvolutionRequest = await req.json();
    const { action, instance_name, webhook_url } = body;

    // Remove trailing slash from api_url
    const baseUrl = api_url.replace(/\/$/, "");

    const headers = {
      "Content-Type": "application/json",
      "apikey": api_key,
    };

    console.log(`[evolution-api] Action: ${action}, Instance: ${instance_name}`);

    switch (action) {
      case "create": {
        // Primeiro verifica se já existe
        const checkResponse = await fetch(`${baseUrl}/instance/fetchInstances`, {
          method: "GET",
          headers,
        });
        
        if (checkResponse.ok) {
          const instances = await checkResponse.json();
          const exists = instances.some((inst: any) => inst.instance?.instanceName === instance_name);
          
          if (exists) {
            console.log(`[evolution-api] Instance ${instance_name} already exists, connecting...`);
            // Se já existe, tenta conectar
            const connectResponse = await fetch(`${baseUrl}/instance/connect/${instance_name}`, {
              method: "GET",
              headers,
            });
            
            const connectData = await connectResponse.json();
            console.log(`[evolution-api] Connect response:`, JSON.stringify(connectData));
            
            return new Response(JSON.stringify({
              success: true,
              exists: true,
              data: connectData,
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }

        // Cria nova instância
        const createResponse = await fetch(`${baseUrl}/instance/create`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            instanceName: instance_name,
            qrcode: true,
            integration: "WHATSAPP-BAILEYS",
          }),
        });

        const createData = await createResponse.json();
        console.log(`[evolution-api] Create response:`, JSON.stringify(createData));

        if (!createResponse.ok) {
          return new Response(JSON.stringify({
            success: false,
            error: createData.message || "Erro ao criar instância",
          }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({
          success: true,
          data: createData,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "connect": {
        const connectResponse = await fetch(`${baseUrl}/instance/connect/${instance_name}`, {
          method: "GET",
          headers,
        });

        const connectData = await connectResponse.json();
        console.log(`[evolution-api] Connect response:`, JSON.stringify(connectData));

        return new Response(JSON.stringify({
          success: true,
          data: connectData,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "status": {
        const statusResponse = await fetch(`${baseUrl}/instance/connectionState/${instance_name}`, {
          method: "GET",
          headers,
        });

        const statusData = await statusResponse.json();
        console.log(`[evolution-api] Status response:`, JSON.stringify(statusData));

        // Se conectado, buscar o número
        let phoneNumber = null;
        if (statusData.state === "open" || statusData.instance?.state === "open") {
          try {
            const fetchResponse = await fetch(`${baseUrl}/instance/fetchInstances`, {
              method: "GET",
              headers,
            });
            
            if (fetchResponse.ok) {
              const instances = await fetchResponse.json();
              console.log(`[evolution-api] fetchInstances count:`, instances?.length);
              
              // Log primeiro item para entender estrutura
              if (instances?.length > 0) {
                console.log(`[evolution-api] First instance structure:`, JSON.stringify(instances[0]));
              }
              
              // Tentar encontrar a instância por nome (pode estar em diferentes locais)
              const currentInstance = instances.find((inst: any) => 
                inst.instance?.instanceName === instance_name || 
                inst.instanceName === instance_name ||
                inst.name === instance_name
              );
              
              if (currentInstance) {
                console.log(`[evolution-api] Found instance:`, JSON.stringify(currentInstance));
                
                // O número pode estar em ownerJid, owner, number ou wuid
                const ownerJid = currentInstance.ownerJid;
                const owner = currentInstance.owner;
                const number = currentInstance.number;
                const wuid = currentInstance.wuid;
                
                console.log(`[evolution-api] ownerJid:`, ownerJid, `owner:`, owner, `number:`, number);
                
                if (ownerJid) {
                  phoneNumber = ownerJid.replace("@s.whatsapp.net", "").replace("@lid", "");
                } else if (owner) {
                  phoneNumber = owner.replace("@s.whatsapp.net", "").replace("@lid", "");
                } else if (number) {
                  phoneNumber = String(number);
                } else if (wuid) {
                  phoneNumber = wuid.replace("@s.whatsapp.net", "").replace("@lid", "");
                }
                
                console.log(`[evolution-api] Extracted phone number:`, phoneNumber);
              }
            }
          } catch (e) {
            console.log(`[evolution-api] Error fetching phone number:`, e);
          }
        }

        return new Response(JSON.stringify({
          success: true,
          data: statusData,
          phoneNumber,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "groups": {
        const groupsResponse = await fetch(`${baseUrl}/group/fetchAllGroups/${instance_name}?getParticipants=false`, {
          method: "GET",
          headers,
        });

        const groupsData = await groupsResponse.json();
        console.log(`[evolution-api] Groups response: ${groupsData?.length || 0} groups`);

        return new Response(JSON.stringify({
          success: true,
          data: groupsData,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "webhook": {
        if (!webhook_url) {
          return new Response(JSON.stringify({
            success: false,
            error: "webhook_url é obrigatório",
          }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const webhookResponse = await fetch(`${baseUrl}/webhook/set/${instance_name}`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            url: webhook_url,
            webhook_by_events: true,
            webhook_base64: false,
            events: ["GROUP_PARTICIPANTS_UPDATE"],
          }),
        });

        const webhookData = await webhookResponse.json();
        console.log(`[evolution-api] Webhook response:`, JSON.stringify(webhookData));

        return new Response(JSON.stringify({
          success: true,
          data: webhookData,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "disconnect": {
        const logoutResponse = await fetch(`${baseUrl}/instance/logout/${instance_name}`, {
          method: "DELETE",
          headers,
        });

        const logoutData = await logoutResponse.json();
        console.log(`[evolution-api] Logout response:`, JSON.stringify(logoutData));

        return new Response(JSON.stringify({
          success: true,
          data: logoutData,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "delete": {
        const deleteResponse = await fetch(`${baseUrl}/instance/delete/${instance_name}`, {
          method: "DELETE",
          headers,
        });

        const deleteData = await deleteResponse.json();
        console.log(`[evolution-api] Delete response:`, JSON.stringify(deleteData));

        return new Response(JSON.stringify({
          success: true,
          data: deleteData,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({
          success: false,
          error: "Ação inválida",
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error: unknown) {
    console.error("[evolution-api] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro interno";
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

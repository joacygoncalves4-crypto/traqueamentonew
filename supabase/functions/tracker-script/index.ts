import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const campanhaSlug = url.searchParams.get("c");

    if (!campanhaSlug) {
      return new Response("// tracker-script: parametro 'c' (slug da campanha) obrigatorio", {
        headers: { ...corsHeaders, "Content-Type": "application/javascript; charset=utf-8" },
        status: 400,
      });
    }

    // Busca campanha pelo grupo_id (slug)
    const { data: campanha, error: campError } = await supabase
      .from("campanhas")
      .select("id, nome, link_grupo, grupo_id, pixel_id, tipo_destino, numero_whatsapp, ativo")
      .eq("grupo_id", campanhaSlug)
      .eq("ativo", true)
      .maybeSingle();

    if (campError || !campanha) {
      return new Response(`// tracker-script: campanha '${campanhaSlug}' nao encontrada ou inativa`, {
        headers: { ...corsHeaders, "Content-Type": "application/javascript; charset=utf-8" },
        status: 404,
      });
    }

    // Busca pixel_id real do Facebook
    let fbPixelId = "";
    if (campanha.pixel_id) {
      const { data: pixelData } = await supabase
        .from("pixels")
        .select("pixel_id")
        .eq("id", campanha.pixel_id)
        .eq("ativo", true)
        .maybeSingle();

      if (pixelData?.pixel_id) {
        fbPixelId = pixelData.pixel_id;
      }
    }

    // Determina URL de destino
    let destinoUrl = campanha.link_grupo;
    if (campanha.tipo_destino === "numero" && campanha.numero_whatsapp) {
      const numero = campanha.numero_whatsapp.replace(/\D/g, "");
      destinoUrl = `https://wa.me/${numero}`;
    }

    // Gera o JavaScript dinâmico com a config da campanha embutida
    const script = generateTrackerScript({
      campanhaId: campanha.id,
      pixelId: fbPixelId,
      destinoUrl,
      trackUrl: `${supabaseUrl}/functions/v1/track-click`,
      apikey: supabaseAnonKey,
    });

    return new Response(script, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "public, max-age=300", // cache 5 min
      },
    });
  } catch (error) {
    console.error("Erro na tracker-script:", error);
    return new Response(`// tracker-script erro: ${String(error)}`, {
      headers: { ...corsHeaders, "Content-Type": "application/javascript; charset=utf-8" },
      status: 500,
    });
  }
});

interface ScriptConfig {
  campanhaId: string;
  pixelId: string;
  destinoUrl: string;
  trackUrl: string;
  apikey: string;
}

function generateTrackerScript(config: ScriptConfig): string {
  return `(function(){
"use strict";
var CFG={
  campanhaId:${JSON.stringify(config.campanhaId)},
  pixelId:${JSON.stringify(config.pixelId)},
  destinoUrl:${JSON.stringify(config.destinoUrl)},
  trackUrl:${JSON.stringify(config.trackUrl)},
  apikey:${JSON.stringify(config.apikey)}
};

// 1. Captura fbclid e UTMs da URL atual
var ps=new URLSearchParams(window.location.search);
var fbclid=ps.get("fbclid")||"";
var utmSource=ps.get("utm_source")||"";
var utmMedium=ps.get("utm_medium")||"";
var utmCampaign=ps.get("utm_campaign")||"";
var utmContent=ps.get("utm_content")||"";
var utmTerm=ps.get("utm_term")||"";

// 2. Carrega Facebook Pixel (gera _fbp no dominio da LP do anunciante)
if(CFG.pixelId){
  (function(f,b,e,v){
    if(f.fbq)return;var n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version="2.0";
    n.queue=[];var t=b.createElement(e);t.async=!0;t.src=v;
    var s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s);
  })(window,document,"script","https://connect.facebook.net/en_US/fbevents.js");
  window.fbq("init",CFG.pixelId);
  window.fbq("track","PageView");
}

// 3. Funcao pra ler cookie _fbp
function getCookie(n){
  var m=document.cookie.match(new RegExp("(^| )"+n+"=([^;]+)"));
  return m?m[2]:"";
}

// 4. Funcao de tracking + redirect
var tracking=false;
function trackAndRedirect(e){
  if(e&&e.preventDefault)e.preventDefault();
  if(tracking)return;
  tracking=true;

  var fbp=getCookie("_fbp");
  var fbc=fbclid?("fb.1."+Math.floor(Date.now()/1000)+"."+fbclid):"";

  var payload={
    campanha_id:CFG.campanhaId,
    fbclid:fbclid||null,
    fbc:fbc||null,
    fbp:fbp||null,
    utm_source:utmSource||null,
    utm_medium:utmMedium||null,
    utm_campaign:utmCampaign||null,
    utm_content:utmContent||null,
    utm_term:utmTerm||null,
    landing_url:window.location.href
  };

  // Envia pro track-click e redireciona
  fetch(CFG.trackUrl,{
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "apikey":CFG.apikey,
      "Authorization":"Bearer "+CFG.apikey
    },
    body:JSON.stringify(payload),
    keepalive:true
  }).catch(function(){}).finally(function(){
    window.location.href=CFG.destinoUrl;
  });

  // Fallback: se o fetch demorar mais de 2s, redireciona mesmo assim
  setTimeout(function(){
    window.location.href=CFG.destinoUrl;
  },2000);
}

// 5. Detecta botao CTA
function attachButton(){
  // Prioridade 1: elemento com data-rastreio
  var btn=document.querySelector("[data-rastreio]");
  if(btn){
    btn.addEventListener("click",trackAndRedirect);
    return;
  }

  // Prioridade 2: links que apontam pra WhatsApp ou Telegram
  var links=document.querySelectorAll('a[href*="chat.whatsapp.com"],a[href*="wa.me"],a[href*="t.me"]');
  if(links.length>0){
    for(var i=0;i<links.length;i++){
      links[i].addEventListener("click",trackAndRedirect);
    }
    return;
  }

  // Prioridade 3: botao/link com texto relevante
  var allBtns=document.querySelectorAll("a, button");
  var keywords=["entrar","participar","grupo","whatsapp","telegram","acessar","quero"];
  for(var j=0;j<allBtns.length;j++){
    var txt=(allBtns[j].textContent||"").toLowerCase();
    for(var k=0;k<keywords.length;k++){
      if(txt.indexOf(keywords[k])!==-1){
        allBtns[j].addEventListener("click",trackAndRedirect);
        return;
      }
    }
  }
}

// Aguarda DOM pronto
if(document.readyState==="loading"){
  document.addEventListener("DOMContentLoaded",attachButton);
}else{
  attachButton();
}

})();`;
}

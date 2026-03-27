import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle, Users, Loader2, Send, Phone } from "lucide-react";

interface Campanha {
  id: string;
  nome: string;
  descricao: string | null;
  link_grupo: string;
  tipo_destino: string | null;
  numero_whatsapp: string | null;
  telegram_chat_id: string | null;
}

const LandingPage = () => {
  const { campanhaId } = useParams<{ campanhaId: string }>();
  const [searchParams] = useSearchParams();
  const [campanha, setCampanha] = useState<Campanha | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    const fetchCampanha = async () => {
      if (!campanhaId) {
        setError("Campanha nao especificada");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("campanhas")
        .select("*")
        .eq("grupo_id", campanhaId)
        .eq("ativo", true)
        .maybeSingle();

      if (error) {
        console.error("Erro ao buscar campanha:", error);
        setError("Erro ao carregar campanha");
      } else if (!data) {
        setError("Campanha nao encontrada");
      } else {
        setCampanha(data);
      }
      setLoading(false);
    };

    fetchCampanha();
  }, [campanhaId]);

  const captureAndRedirect = async () => {
    if (!campanha) return;
    setRedirecting(true);

    // ==========================================
    // CAPTURA DE DADOS DE ATRIBUICAO DO FACEBOOK
    // ==========================================

    // 1. fbclid - Facebook Click ID (vem automatico na URL do anuncio)
    const fbclid = searchParams.get("fbclid");
    const fbc = fbclid ? `fb.1.${Date.now()}.${fbclid}` : null;

    // 2. fbp - Facebook Browser Pixel ID (cookie _fbp gerado pelo pixel)
    const fbpCookie = document.cookie
      .split(";")
      .find((c) => c.trim().startsWith("_fbp="));
    const fbp = fbpCookie ? fbpCookie.split("=")[1] : null;

    // 3. UTMs do anuncio
    const utm_source = searchParams.get("utm_source");
    const utm_medium = searchParams.get("utm_medium");
    const utm_campaign = searchParams.get("utm_campaign");
    const utm_content = searchParams.get("utm_content");
    const utm_term = searchParams.get("utm_term");

    // 4. Dados do browser
    const user_agent = navigator.userAgent;
    const landing_url = window.location.href;

    // ==========================================
    // SALVA NO BANCO (tabela cliques)
    // ==========================================
    try {
      await supabase.from("cliques").insert({
        campanha_id: campanha.id,
        fbclid,
        fbc,
        fbp,
        utm_source,
        utm_medium,
        utm_campaign,
        utm_content,
        utm_term,
        user_agent,
        landing_url,
      });
    } catch (err) {
      console.error("Erro ao salvar clique:", err);
      // Nao bloqueia o redirecionamento se falhar o insert
    }

    // ==========================================
    // REDIRECIONA PARA O DESTINO CORRETO
    // ==========================================
    const tipoDestino = campanha.tipo_destino || "grupo";
    let redirectUrl = "";

    if (tipoDestino === "numero" && campanha.numero_whatsapp) {
      // Redireciona para conversa direta no WhatsApp
      const numero = campanha.numero_whatsapp.replace(/\D/g, "");
      redirectUrl = `https://wa.me/${numero}`;
    } else if (tipoDestino === "telegram" && campanha.link_grupo) {
      // Redireciona para grupo/canal Telegram
      redirectUrl = campanha.link_grupo;
    } else {
      // Redireciona para grupo WhatsApp (padrao)
      redirectUrl = campanha.link_grupo;
    }

    if (redirectUrl) {
      // Delay de 1.5s para garantir que o insert foi processado
      setTimeout(() => {
        window.location.href = redirectUrl;
      }, 1500);
    } else {
      setRedirecting(false);
    }
  };

  // ==========================================
  // RENDERIZACAO
  // ==========================================

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-green-100">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    );
  }

  if (error || !campanha) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-red-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-red-600">Oops!</CardTitle>
            <CardDescription>{error || "Campanha nao encontrada"}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Determina icone e textos baseado no tipo de destino
  const tipoDestino = campanha.tipo_destino || "grupo";

  const config = {
    grupo: {
      icon: Users,
      gradient: "from-green-50 via-white to-green-100",
      buttonGradient: "from-green-500 to-green-600 hover:from-green-600 hover:to-green-700",
      iconBg: "from-green-500 to-green-600",
      subtitle: "Grupo exclusivo no WhatsApp",
      buttonText: "Entrar no Grupo",
      buttonIcon: MessageCircle,
      redirectText: "Voce sera redirecionado para o WhatsApp",
    },
    numero: {
      icon: Phone,
      gradient: "from-green-50 via-white to-emerald-100",
      buttonGradient: "from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700",
      iconBg: "from-emerald-500 to-green-600",
      subtitle: "Fale diretamente no WhatsApp",
      buttonText: "Iniciar Conversa",
      buttonIcon: MessageCircle,
      redirectText: "Voce sera redirecionado para o WhatsApp",
    },
    telegram: {
      icon: Send,
      gradient: "from-blue-50 via-white to-cyan-100",
      buttonGradient: "from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700",
      iconBg: "from-blue-500 to-cyan-600",
      subtitle: "Canal exclusivo no Telegram",
      buttonText: "Entrar no Canal",
      buttonIcon: Send,
      redirectText: "Voce sera redirecionado para o Telegram",
    },
  };

  const c = config[tipoDestino as keyof typeof config] || config.grupo;
  const IconMain = c.icon;
  const IconButton = c.buttonIcon;

  if (redirecting) {
    return (
      <div className={`min-h-screen flex items-center justify-center bg-gradient-to-br ${c.gradient} p-4`}>
        <div className="text-center space-y-4">
          <div className={`mx-auto w-20 h-20 bg-gradient-to-br ${c.iconBg} rounded-full flex items-center justify-center shadow-lg animate-pulse`}>
            <IconMain className="h-10 w-10 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Redirecionando...</h2>
            <p className="text-sm text-gray-500 mt-1">Aguarde, voce sera redirecionado em instantes</p>
          </div>
          <Loader2 className="h-6 w-6 animate-spin text-gray-400 mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex items-center justify-center bg-gradient-to-br ${c.gradient} p-4`}>
      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className={`mx-auto w-20 h-20 bg-gradient-to-br ${c.iconBg} rounded-full flex items-center justify-center shadow-lg`}>
            <IconMain className="h-10 w-10 text-white" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-gray-900">
              {campanha.nome}
            </CardTitle>
            {campanha.descricao && (
              <CardDescription className="mt-2 text-gray-600">
                {campanha.descricao}
              </CardDescription>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-4">
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
            <IconMain className="h-4 w-4" />
            <span>{c.subtitle}</span>
          </div>

          <Button
            onClick={captureAndRedirect}
            className={`w-full h-14 text-lg font-semibold bg-gradient-to-r ${c.buttonGradient} shadow-lg hover:shadow-xl transition-all duration-200`}
          >
            <IconButton className="mr-2 h-5 w-5" />
            {c.buttonText}
          </Button>

          <p className="text-xs text-center text-gray-400">
            Ao clicar, {c.redirectText.toLowerCase()}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default LandingPage;

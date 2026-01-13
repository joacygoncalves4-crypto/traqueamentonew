import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle, Users, Loader2 } from "lucide-react";

interface Campanha {
  id: string;
  nome: string;
  descricao: string | null;
  link_grupo: string;
}

const LandingPage = () => {
  const { campanhaId } = useParams<{ campanhaId: string }>();
  const [searchParams] = useSearchParams();
  const [campanha, setCampanha] = useState<Campanha | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCampanha = async () => {
      if (!campanhaId) {
        setError("Campanha não especificada");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("campanhas")
        .select("id, nome, descricao, link_grupo")
        .eq("grupo_id", campanhaId)
        .eq("ativo", true)
        .maybeSingle();

      if (error) {
        console.error("Erro ao buscar campanha:", error);
        setError("Erro ao carregar campanha");
      } else if (!data) {
        setError("Campanha não encontrada");
      } else {
        setCampanha(data);
      }
      setLoading(false);
    };

    fetchCampanha();
  }, [campanhaId]);

  const handleEntrarGrupo = () => {
    if (!campanha) return;

    // Capturar UTMs para analytics (pode ser usado no futuro)
    const utmData = {
      utm_source: searchParams.get("utm_source"),
      utm_medium: searchParams.get("utm_medium"),
      utm_campaign: searchParams.get("utm_campaign"),
      utm_term: searchParams.get("utm_term"),
      utm_content: searchParams.get("utm_content"),
    };
    
    console.log("UTM Data:", utmData);
    
    // Redirecionar para o grupo
    window.location.href = campanha.link_grupo;
  };

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
            <CardDescription>{error || "Campanha não encontrada"}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-white to-green-100 p-4">
      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="mx-auto w-20 h-20 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-lg">
            <MessageCircle className="h-10 w-10 text-white" />
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
            <Users className="h-4 w-4" />
            <span>Grupo exclusivo no WhatsApp</span>
          </div>
          
          <Button
            onClick={handleEntrarGrupo}
            className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 shadow-lg hover:shadow-xl transition-all duration-200"
          >
            <MessageCircle className="mr-2 h-5 w-5" />
            Entrar no Grupo VIP
          </Button>
          
          <p className="text-xs text-center text-gray-400">
            Ao clicar, você será redirecionado para o WhatsApp
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default LandingPage;

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Copy, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import AdminLayout from "@/components/admin/AdminLayout";

interface Configuracao {
  id: string;
  webhook_secret: string | null;
}

const Configuracoes = () => {
  const [config, setConfig] = useState<Configuracao | null>(null);
  const [loading, setLoading] = useState(true);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-evolution`;

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    const { data, error } = await supabase
      .from("configuracoes")
      .select("id, webhook_secret")
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Erro ao buscar configurações:", error);
      toast.error("Erro ao carregar configurações");
    } else if (data) {
      setConfig(data);
    }
    setLoading(false);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Configurações</h1>
          <p className="text-muted-foreground">
            Configure as integrações do sistema
          </p>
        </div>

        {/* Webhook URL */}
        <Card>
          <CardHeader>
            <CardTitle>Webhook da Evolution API</CardTitle>
            <CardDescription>
              Configure este URL no seu painel da Evolution API para receber eventos de entrada no grupo
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>URL do Webhook</Label>
              <div className="flex gap-2">
                <Input value={webhookUrl} readOnly className="font-mono text-sm" />
                <Button
                  variant="outline"
                  onClick={() => copyToClipboard(webhookUrl, "URL do Webhook")}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {config?.webhook_secret && (
              <div className="space-y-2">
                <Label>Secret do Webhook</Label>
                <div className="flex gap-2">
                  <Input
                    value={config.webhook_secret}
                    readOnly
                    className="font-mono text-sm"
                    type="password"
                  />
                  <Button
                    variant="outline"
                    onClick={() =>
                      copyToClipboard(config.webhook_secret!, "Secret")
                    }
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Use este secret para validar as requisições do webhook
                </p>
              </div>
            )}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Na Evolution API, configure o webhook para o evento <strong>GROUP_PARTICIPANTS_UPDATE</strong>.
                O sistema filtra automaticamente apenas entradas (action: add).
              </AlertDescription>
            </Alert>
            <div className="text-sm text-muted-foreground space-y-1">
              <p><strong>Como obter o JID do grupo:</strong></p>
              <p>1. Via API: <code className="bg-muted px-1 rounded">GET /group/fetchAllGroups/{"{instance}"}</code></p>
              <p>2. Via logs: Quando o primeiro lead entrar, o JID aparecerá nos logs do webhook</p>
            </div>
          </CardContent>
        </Card>

        {/* Instruções */}
        <Card>
          <CardHeader>
            <CardTitle>Como Usar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-semibold">1. Configure a Evolution API</h4>
              <p className="text-sm text-muted-foreground">
                No painel da Evolution API, adicione um webhook apontando para a URL acima.
                Configure para o evento <strong>GROUP_PARTICIPANTS_UPDATE</strong>.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold">2. Cadastre os Pixels</h4>
              <p className="text-sm text-muted-foreground">
                Na aba <strong>Pixels</strong>, cadastre seus Pixel IDs e Access Tokens do Facebook.
                Você pode ter múltiplos pixels para diferentes campanhas.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold">3. Crie Campanhas</h4>
              <p className="text-sm text-muted-foreground">
                Na aba <strong>Campanhas</strong>, crie uma campanha para cada grupo de WhatsApp.
                Selecione o Pixel que receberá os eventos e use o link gerado nos seus anúncios do Facebook.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold">4. Acompanhe no Dashboard</h4>
              <p className="text-sm text-muted-foreground">
                Veja todos os eventos de entrada em tempo real no Dashboard.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default Configuracoes;

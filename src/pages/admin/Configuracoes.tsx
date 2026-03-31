import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Copy, Loader2, AlertCircle, Save } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import AdminLayout from "@/components/admin/AdminLayout";

interface Configuracao {
  id: string;
  webhook_secret: string | null;
  evolution_api_url: string | null;
  evolution_api_key: string | null;
}

const Configuracoes = () => {
  const [config, setConfig] = useState<Configuracao | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [evolutionUrl, setEvolutionUrl] = useState("");
  const [evolutionKey, setEvolutionKey] = useState("");

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-evolution`;

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    const { data, error } = await supabase
      .from("configuracoes")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Erro ao buscar configurações:", error);
      toast.error("Erro ao carregar configurações");
    } else if (data) {
      setConfig(data);
      setEvolutionUrl(data.evolution_api_url || "");
      setEvolutionKey(data.evolution_api_key || "");
    }
    setLoading(false);
  };

  const saveEvolutionConfig = async () => {
    if (!config) return;
    setSaving(true);
    const { error } = await supabase
      .from("configuracoes")
      .update({
        evolution_api_url: evolutionUrl.replace(/\/$/, ""),
        evolution_api_key: evolutionKey,
      })
      .eq("id", config.id);

    if (error) {
      toast.error("Erro ao salvar configurações");
    } else {
      toast.success("Credenciais da Evolution API salvas!");
    }
    setSaving(false);
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

        {/* Evolution API Credentials */}
        <Card>
          <CardHeader>
            <CardTitle>Evolution API</CardTitle>
            <CardDescription>
              Configure as credenciais da sua Evolution API para conectar instâncias WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>URL da API</Label>
              <Input
                value={evolutionUrl}
                onChange={(e) => setEvolutionUrl(e.target.value)}
                placeholder="https://sua-evolution-api.com"
              />
            </div>
            <div className="space-y-2">
              <Label>API Key</Label>
              <Input
                value={evolutionKey}
                onChange={(e) => setEvolutionKey(e.target.value)}
                placeholder="Sua chave da API"
                type="password"
              />
            </div>
            <Button onClick={saveEvolutionConfig} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar Credenciais
            </Button>
          </CardContent>
        </Card>

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
              </div>
            )}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Na Evolution API, configure o webhook para o evento <strong>GROUP_PARTICIPANTS_UPDATE</strong>.
                O sistema filtra automaticamente apenas entradas (action: add).
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Instruções */}
        <Card>
          <CardHeader>
            <CardTitle>Como Usar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-semibold">1. Configure a Evolution API (acima)</h4>
              <p className="text-sm text-muted-foreground">
                Adicione a URL e API Key da sua Evolution API. As credenciais são salvas no banco de dados.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold">2. Conecte um Número WhatsApp</h4>
              <p className="text-sm text-muted-foreground">
                Na aba <strong>Instâncias</strong>, conecte um número escaneando o QR Code.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold">3. Cadastre os Pixels</h4>
              <p className="text-sm text-muted-foreground">
                Na aba <strong>Pixels</strong>, cadastre seus Pixel IDs e Access Tokens do Facebook.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold">4. Crie Campanhas</h4>
              <p className="text-sm text-muted-foreground">
                Na aba <strong>Campanhas</strong>, crie uma campanha vinculando pixel + instância + grupo.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold">5. Acompanhe no Dashboard</h4>
              <p className="text-sm text-muted-foreground">
                Veja todos os eventos e atribuição em tempo real no Dashboard.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default Configuracoes;

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Code, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface TrackingExternoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campanha: {
    id: string;
    nome: string;
    grupo_id: string;
  } | null;
}

const TrackingExternoDialog = ({ open, onOpenChange, campanha }: TrackingExternoDialogProps) => {
  const [copied, setCopied] = useState(false);

  if (!campanha) return null;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const scriptTag = `<script src="${supabaseUrl}/functions/v1/tracker-script?c=${campanha.grupo_id}"></script>`;

  const copyScript = () => {
    navigator.clipboard.writeText(scriptTag);
    setCopied(true);
    toast.success("Script copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            Tracking Externo
          </DialogTitle>
          <DialogDescription>
            Use este script na sua landing page externa para rastrear conversoes
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info da campanha */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Campanha:</span>
            <Badge variant="outline">{campanha.nome}</Badge>
          </div>

          {/* Script tag */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Cole este script no header da sua landing page:</label>
            <div className="relative">
              <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto border select-all">
                {scriptTag}
              </pre>
              <Button
                variant="outline"
                size="sm"
                className="absolute top-2 right-2"
                onClick={copyScript}
              >
                {copied ? (
                  <Check className="h-3 w-3 text-green-600" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </div>
          </div>

          {/* O que o script faz */}
          <div className="p-4 border rounded-lg bg-muted/50 space-y-2">
            <p className="text-sm font-medium">O que o script faz automaticamente:</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>1. Captura o <code className="bg-background px-1 rounded">fbclid</code> e UTMs da URL do anuncio</li>
              <li>2. Carrega o Facebook Pixel e dispara <code className="bg-background px-1 rounded">PageView</code></li>
              <li>3. Detecta o botao CTA da sua pagina</li>
              <li>4. No clique: registra o rastreamento e redireciona pro WhatsApp/Telegram</li>
            </ul>
          </div>

          {/* Deteccao de botao */}
          <div className="p-4 border rounded-lg space-y-2">
            <p className="text-sm font-medium">Como o script detecta o botao?</p>
            <div className="text-xs text-muted-foreground space-y-2">
              <p>O script detecta automaticamente por esta ordem:</p>
              <ol className="list-decimal ml-4 space-y-1">
                <li>Elemento com atributo <code className="bg-muted px-1 rounded">data-rastreio</code> (mais confiavel)</li>
                <li>Links que apontam pra <code className="bg-muted px-1 rounded">chat.whatsapp.com</code>, <code className="bg-muted px-1 rounded">wa.me</code> ou <code className="bg-muted px-1 rounded">t.me</code></li>
                <li>Botoes com texto tipo "Entrar", "Participar", "Grupo", "WhatsApp"</li>
              </ol>
              <div className="mt-2 p-2 bg-background rounded border">
                <p className="font-medium mb-1">Dica: pra garantir, adicione este atributo no botao da sua LP:</p>
                <code className="text-xs">data-rastreio="true"</code>
              </div>
            </div>
          </div>

          {/* Instrucoes por page builder */}
          <div className="p-4 border rounded-lg space-y-2">
            <p className="text-sm font-medium">Onde colar em cada plataforma:</p>
            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>Kiwify Pages:</strong> Configuracoes da pagina &gt; Scripts personalizados &gt; Header</p>
              <p><strong>Hotmart Pages:</strong> Configuracoes &gt; Codigo personalizado &gt; Head</p>
              <p><strong>Elementor:</strong> Configuracoes da pagina &gt; Custom Code &gt; Head</p>
              <p><strong>WordPress:</strong> Tema &gt; Header (ou plugin Insert Headers and Footers)</p>
              <p><strong>Qualquer outro:</strong> Procure por "Script no header" ou "Custom code"</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TrackingExternoDialog;

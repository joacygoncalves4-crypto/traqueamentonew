import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import AdminLayout from "@/components/admin/AdminLayout";

interface Pixel {
  id: string;
  nome: string;
  pixel_id: string;
  access_token: string;
  ativo: boolean;
  created_at: string;
  test_event_code: string | null;
}

const Pixels = () => {
  const [pixels, setPixels] = useState<Pixel[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showToken, setShowToken] = useState<Record<string, boolean>>({});
  const [editingTestCode, setEditingTestCode] = useState<string | null>(null);
  const [testCodeValue, setTestCodeValue] = useState("");
  const [formData, setFormData] = useState({
    nome: "",
    pixel_id: "",
    access_token: "",
    test_event_code: "",
  });

  useEffect(() => {
    fetchPixels();
  }, []);

  const fetchPixels = async () => {
    const { data, error } = await supabase
      .from("pixels")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao buscar pixels:", error);
      toast.error("Erro ao carregar pixels");
    } else {
      setPixels(data || []);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const { error } = await supabase.from("pixels").insert({
      nome: formData.nome,
      pixel_id: formData.pixel_id,
      access_token: formData.access_token,
      test_event_code: formData.test_event_code || null,
    });

    if (error) {
      console.error("Erro ao criar pixel:", error);
      toast.error("Erro ao criar pixel");
    } else {
      toast.success("Pixel adicionado com sucesso!");
      setDialogOpen(false);
      setFormData({ nome: "", pixel_id: "", access_token: "", test_event_code: "" });
      fetchPixels();
    }
    setSaving(false);
  };

  const toggleAtivo = async (id: string, ativo: boolean) => {
    const { error } = await supabase
      .from("pixels")
      .update({ ativo })
      .eq("id", id);

    if (error) {
      toast.error("Erro ao atualizar pixel");
    } else {
      setPixels(pixels.map((p) => (p.id === id ? { ...p, ativo } : p)));
    }
  };

  const deletePixel = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este pixel?")) return;

    const { error } = await supabase.from("pixels").delete().eq("id", id);

    if (error) {
      toast.error("Erro ao excluir pixel. Verifique se não está em uso por alguma campanha.");
    } else {
      toast.success("Pixel excluído");
      setPixels(pixels.filter((p) => p.id !== id));
    }
  };

  const toggleShowToken = (id: string) => {
    setShowToken((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const maskToken = (token: string) => {
    if (token.length <= 10) return "••••••••";
    return `${token.slice(0, 6)}${"•".repeat(20)}${token.slice(-4)}`;
  };

  const startEditTestCode = (pixel: Pixel) => {
    setEditingTestCode(pixel.id);
    setTestCodeValue(pixel.test_event_code || "");
  };

  const saveTestCode = async (id: string) => {
    const { error } = await supabase
      .from("pixels")
      .update({ test_event_code: testCodeValue || null })
      .eq("id", id);

    if (error) {
      toast.error("Erro ao atualizar código de teste");
    } else {
      setPixels(pixels.map((p) => 
        p.id === id ? { ...p, test_event_code: testCodeValue || null } : p
      ));
      toast.success(testCodeValue ? "Modo teste ativado!" : "Modo produção ativado!");
    }
    setEditingTestCode(null);
    setTestCodeValue("");
  };

  const clearTestCode = async (id: string) => {
    const { error } = await supabase
      .from("pixels")
      .update({ test_event_code: null })
      .eq("id", id);

    if (error) {
      toast.error("Erro ao limpar código de teste");
    } else {
      setPixels(pixels.map((p) => 
        p.id === id ? { ...p, test_event_code: null } : p
      ));
      toast.success("Modo produção ativado!");
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Pixels</h1>
            <p className="text-muted-foreground">
              Gerencie seus pixels do Facebook para rastreamento de conversões
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Novo Pixel
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Pixel</DialogTitle>
                <DialogDescription>
                  Cadastre um novo pixel do Facebook para rastrear conversões
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome do Pixel</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) =>
                      setFormData({ ...formData, nome: e.target.value })
                    }
                    placeholder="Ex: Pixel Principal"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pixel_id">Pixel ID</Label>
                  <Input
                    id="pixel_id"
                    value={formData.pixel_id}
                    onChange={(e) =>
                      setFormData({ ...formData, pixel_id: e.target.value })
                    }
                    placeholder="Ex: 1234567890123456"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Encontre o Pixel ID no Gerenciador de Eventos do Facebook
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="access_token">Access Token (CAPI)</Label>
                  <Input
                    id="access_token"
                    type="password"
                    value={formData.access_token}
                    onChange={(e) =>
                      setFormData({ ...formData, access_token: e.target.value })
                    }
                    placeholder="Token de acesso da Conversions API"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Gere o token no Gerenciador de Eventos → Configurações → Token de Acesso
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="test_event_code">Código de Teste (opcional)</Label>
                  <Input
                    id="test_event_code"
                    value={formData.test_event_code}
                    onChange={(e) =>
                      setFormData({ ...formData, test_event_code: e.target.value })
                    }
                    placeholder="Ex: TEST12345"
                  />
                  <p className="text-xs text-muted-foreground">
                    Se preenchido, os eventos irão para a aba "Eventos de Teste" do Facebook
                  </p>
                </div>

                <Button type="submit" className="w-full" disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    "Adicionar Pixel"
                  )}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Seus Pixels</CardTitle>
            <CardDescription>
              Cada campanha pode ser associada a um pixel diferente
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : pixels.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Nenhum pixel cadastrado ainda</p>
                <p className="text-sm">Clique em "Novo Pixel" para começar</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Pixel ID</TableHead>
                    <TableHead>Access Token</TableHead>
                    <TableHead>Modo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pixels.map((pixel) => (
                    <TableRow key={pixel.id}>
                      <TableCell className="font-medium">
                        {pixel.nome}
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {pixel.pixel_id}
                        </code>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {showToken[pixel.id] 
                              ? pixel.access_token 
                              : maskToken(pixel.access_token)}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleShowToken(pixel.id)}
                          >
                            {showToken[pixel.id] ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        {editingTestCode === pixel.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={testCodeValue}
                              onChange={(e) => setTestCodeValue(e.target.value)}
                              placeholder="TEST12345"
                              className="w-32 h-8 text-xs"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => saveTestCode(pixel.id)}
                            >
                              Salvar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingTestCode(null)}
                            >
                              ✕
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            {pixel.test_event_code ? (
                              <>
                                <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                                  Teste
                                </Badge>
                                <code className="text-xs bg-muted px-1 rounded">
                                  {pixel.test_event_code}
                                </code>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => clearTestCode(pixel.id)}
                                  title="Ir para produção"
                                >
                                  ✕
                                </Button>
                              </>
                            ) : (
                              <>
                                <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                                  Produção
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => startEditTestCode(pixel)}
                                  title="Ativar modo teste"
                                >
                                  + Teste
                                </Button>
                              </>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={pixel.ativo}
                            onCheckedChange={(checked) =>
                              toggleAtivo(pixel.id, checked)
                            }
                          />
                          <Badge variant={pixel.ativo ? "default" : "secondary"}>
                            {pixel.ativo ? "Ativo" : "Inativo"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deletePixel(pixel.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Instruções */}
        <Card>
          <CardHeader>
            <CardTitle>Como Usar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-medium">1. Obter o Pixel ID</h4>
              <p className="text-sm text-muted-foreground">
                Acesse o <strong>Gerenciador de Eventos</strong> do Facebook e copie o ID do seu pixel.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">2. Gerar o Access Token</h4>
              <p className="text-sm text-muted-foreground">
                No Gerenciador de Eventos, vá em <strong>Configurações</strong> → <strong>Token de Acesso</strong> e gere um token para a Conversions API.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">3. Associar às Campanhas</h4>
              <p className="text-sm text-muted-foreground">
                Ao criar ou editar uma campanha, selecione qual pixel deve receber os eventos de conversão.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default Pixels;

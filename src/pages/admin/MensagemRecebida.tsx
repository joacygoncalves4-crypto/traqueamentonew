import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import AdminLayout from "@/components/admin/AdminLayout";

interface Gatilho {
  id: string;
  nome: string;
  instance_name: string;
  keyword: string;
  pixel_id: string | null;
  ativo: boolean;
  created_at: string;
}

interface Pixel {
  id: string;
  nome: string;
  pixel_id: string;
}

const MensagemRecebida = () => {
  const [gatilhos, setGatilhos] = useState<Gatilho[]>([]);
  const [pixels, setPixels] = useState<Pixel[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingGatilho, setEditingGatilho] = useState<Gatilho | null>(null);
  const [formData, setFormData] = useState({
    nome: "",
    instance_name: "",
    keyword: "",
    pixel_id: "",
  });

  useEffect(() => {
    fetchGatilhos();
    fetchPixels();
  }, []);

  const fetchGatilhos = async () => {
    const { data, error } = await supabase
      .from("mensagem_gatilhos")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao buscar gatilhos:", error);
      toast.error("Erro ao carregar gatilhos");
    } else {
      setGatilhos(data || []);
    }
    setLoading(false);
  };

  const fetchPixels = async () => {
    const { data, error } = await supabase
      .from("pixels")
      .select("id, nome, pixel_id")
      .eq("ativo", true)
      .order("nome");

    if (error) {
      console.error("Erro ao buscar pixels:", error);
    } else {
      setPixels(data || []);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const { error } = await supabase.from("mensagem_gatilhos").insert({
      nome: formData.nome,
      instance_name: formData.instance_name,
      keyword: formData.keyword,
      pixel_id: formData.pixel_id || null,
    });

    if (error) {
      console.error("Erro ao criar gatilho:", error);
      toast.error("Erro ao criar gatilho");
    } else {
      toast.success("Gatilho criado com sucesso!");
      setDialogOpen(false);
      resetForm();
      fetchGatilhos();
    }
    setSaving(false);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGatilho) return;
    setSaving(true);

    const { error } = await supabase
      .from("mensagem_gatilhos")
      .update({
        nome: formData.nome,
        instance_name: formData.instance_name,
        keyword: formData.keyword,
        pixel_id: formData.pixel_id || null,
      })
      .eq("id", editingGatilho.id);

    if (error) {
      console.error("Erro ao atualizar gatilho:", error);
      toast.error("Erro ao atualizar gatilho");
    } else {
      toast.success("Gatilho atualizado!");
      setEditDialogOpen(false);
      setEditingGatilho(null);
      resetForm();
      fetchGatilhos();
    }
    setSaving(false);
  };

  const toggleAtivo = async (id: string, ativo: boolean) => {
    const { error } = await supabase
      .from("mensagem_gatilhos")
      .update({ ativo })
      .eq("id", id);

    if (error) {
      toast.error("Erro ao atualizar status");
    } else {
      setGatilhos(gatilhos.map((g) => (g.id === id ? { ...g, ativo } : g)));
    }
  };

  const deleteGatilho = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este gatilho?")) return;

    const { error } = await supabase.from("mensagem_gatilhos").delete().eq("id", id);

    if (error) {
      toast.error("Erro ao excluir gatilho");
    } else {
      toast.success("Gatilho excluído");
      setGatilhos(gatilhos.filter((g) => g.id !== id));
    }
  };

  const openEditDialog = (gatilho: Gatilho) => {
    setEditingGatilho(gatilho);
    setFormData({
      nome: gatilho.nome,
      instance_name: gatilho.instance_name,
      keyword: gatilho.keyword,
      pixel_id: gatilho.pixel_id || "",
    });
    setEditDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({ nome: "", instance_name: "", keyword: "", pixel_id: "" });
  };

  const getPixelName = (pixelId: string | null) => {
    if (!pixelId) return "—";
    const pixel = pixels.find((p) => p.id === pixelId);
    return pixel ? pixel.nome : "—";
  };

  const renderForm = (onSubmit: (e: React.FormEvent) => void, isEdit: boolean) => (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="nome">Nome do Evento</Label>
        <Input
          id="nome"
          value={formData.nome}
          onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
          placeholder='Ex: "Primeira Mensagem - ENTREI"'
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="instance_name">Instância Evolution</Label>
        <Input
          id="instance_name"
          value={formData.instance_name}
          onChange={(e) => setFormData({ ...formData, instance_name: e.target.value })}
          placeholder="Ex: instancia01"
          required
        />
        <p className="text-xs text-muted-foreground">
          Nome exato da instância na Evolution API
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="keyword">Texto Gatilho (Keyword)</Label>
        <Input
          id="keyword"
          value={formData.keyword}
          onChange={(e) => setFormData({ ...formData, keyword: e.target.value })}
          placeholder='Ex: "ENTREI"'
          required
        />
        <p className="text-xs text-muted-foreground">
          O evento será disparado quando a mensagem contiver este texto (case-insensitive)
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="pixel">Pixel do Facebook</Label>
        <Select
          value={formData.pixel_id}
          onValueChange={(value) => setFormData({ ...formData, pixel_id: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione um pixel" />
          </SelectTrigger>
          <SelectContent>
            {pixels.length === 0 ? (
              <SelectItem value="_none" disabled>Nenhum pixel cadastrado</SelectItem>
            ) : (
              pixels.map((pixel) => (
                <SelectItem key={pixel.id} value={pixel.id}>
                  {pixel.nome} ({pixel.pixel_id})
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      <Button type="submit" className="w-full" disabled={saving}>
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isEdit ? "Salvar Alterações" : "Criar Gatilho"}
      </Button>
    </form>
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Mensagem Recebida</h1>
            <p className="text-muted-foreground">
              Configure gatilhos por keyword para disparar eventos ao receber mensagens
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Novo Gatilho
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Novo Gatilho</DialogTitle>
                <DialogDescription>
                  Crie um gatilho que dispara quando uma mensagem com a keyword for recebida
                </DialogDescription>
              </DialogHeader>
              {renderForm(handleSubmit, false)}
            </DialogContent>
          </Dialog>
        </div>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Editar Gatilho</DialogTitle>
              <DialogDescription>Atualize as configurações do gatilho</DialogDescription>
            </DialogHeader>
            {renderForm(handleEditSubmit, true)}
          </DialogContent>
        </Dialog>

        <Card>
          <CardHeader>
            <CardTitle>Gatilhos Configurados</CardTitle>
            <CardDescription>
              Quando uma mensagem contiver a keyword configurada, o evento será enviado ao Pixel
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : gatilhos.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum gatilho configurado. Crie o primeiro acima.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Instância</TableHead>
                    <TableHead>Keyword</TableHead>
                    <TableHead>Pixel</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gatilhos.map((gatilho) => (
                    <TableRow key={gatilho.id}>
                      <TableCell className="font-medium">{gatilho.nome}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{gatilho.instance_name}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{gatilho.keyword}</Badge>
                      </TableCell>
                      <TableCell>{getPixelName(gatilho.pixel_id)}</TableCell>
                      <TableCell>
                        <Switch
                          checked={gatilho.ativo}
                          onCheckedChange={(checked) => toggleAtivo(gatilho.id, checked)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(gatilho)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteGatilho(gatilho.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default MensagemRecebida;

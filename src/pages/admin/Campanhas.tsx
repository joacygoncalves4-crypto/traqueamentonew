import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Copy, Trash2, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import AdminLayout from "@/components/admin/AdminLayout";

interface Campanha {
  id: string;
  nome: string;
  descricao: string | null;
  link_grupo: string;
  grupo_id: string;
  whatsapp_group_jid: string | null;
  instancia_id: string | null;
  ativo: boolean;
  created_at: string;
}

interface Instancia {
  id: string;
  nome: string;
  instance_name: string;
  status: string;
}

interface Grupo {
  id: string;
  group_jid: string;
  group_name: string;
  instancia_id: string;
}

const Campanhas = () => {
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [instancias, setInstancias] = useState<Instancia[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    nome: "",
    descricao: "",
    link_grupo: "",
    grupo_id: "",
    whatsapp_group_jid: "",
    instancia_id: "",
    grupo_selecionado_id: "",
  });

  useEffect(() => {
    fetchCampanhas();
    fetchInstancias();
  }, []);

  useEffect(() => {
    if (formData.instancia_id) {
      fetchGrupos(formData.instancia_id);
    } else {
      setGrupos([]);
    }
  }, [formData.instancia_id]);

  const fetchCampanhas = async () => {
    const { data, error } = await supabase
      .from("campanhas")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao buscar campanhas:", error);
      toast.error("Erro ao carregar campanhas");
    } else {
      setCampanhas(data || []);
    }
    setLoading(false);
  };

  const fetchInstancias = async () => {
    const { data, error } = await supabase
      .from("evolution_instancias")
      .select("id, nome, instance_name, status")
      .eq("status", "connected")
      .order("nome");

    if (error) {
      console.error("Erro ao buscar instâncias:", error);
    } else {
      setInstancias(data || []);
    }
  };

  const fetchGrupos = async (instanciaId: string) => {
    const { data, error } = await supabase
      .from("evolution_grupos")
      .select("id, group_jid, group_name, instancia_id")
      .eq("instancia_id", instanciaId)
      .order("group_name");

    if (error) {
      console.error("Erro ao buscar grupos:", error);
    } else {
      setGrupos(data || []);
    }
  };

  const handleGrupoChange = (grupoId: string) => {
    const grupo = grupos.find(g => g.id === grupoId);
    if (grupo) {
      setFormData({
        ...formData,
        grupo_selecionado_id: grupoId,
        whatsapp_group_jid: grupo.group_jid,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const { error } = await supabase.from("campanhas").insert({
      nome: formData.nome,
      descricao: formData.descricao || null,
      link_grupo: formData.link_grupo,
      grupo_id: formData.grupo_id,
      whatsapp_group_jid: formData.whatsapp_group_jid || null,
      instancia_id: formData.instancia_id || null,
    });

    if (error) {
      console.error("Erro ao criar campanha:", error);
      toast.error("Erro ao criar campanha. Verifique se o ID do grupo já existe.");
    } else {
      toast.success("Campanha criada com sucesso!");
      setDialogOpen(false);
      setFormData({ 
        nome: "", 
        descricao: "", 
        link_grupo: "", 
        grupo_id: "", 
        whatsapp_group_jid: "",
        instancia_id: "",
        grupo_selecionado_id: "",
      });
      fetchCampanhas();
    }
    setSaving(false);
  };

  const toggleAtivo = async (id: string, ativo: boolean) => {
    const { error } = await supabase
      .from("campanhas")
      .update({ ativo })
      .eq("id", id);

    if (error) {
      toast.error("Erro ao atualizar campanha");
    } else {
      setCampanhas(campanhas.map((c) => (c.id === id ? { ...c, ativo } : c)));
    }
  };

  const deleteCampanha = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta campanha?")) return;

    const { error } = await supabase.from("campanhas").delete().eq("id", id);

    if (error) {
      toast.error("Erro ao excluir campanha");
    } else {
      toast.success("Campanha excluída");
      setCampanhas(campanhas.filter((c) => c.id !== id));
    }
  };

  const copyLink = (grupoId: string) => {
    const link = `${window.location.origin}/entrar/${grupoId}`;
    navigator.clipboard.writeText(link);
    toast.success("Link copiado para a área de transferência!");
  };

  const generateSlug = (nome: string) => {
    return nome
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Campanhas</h1>
            <p className="text-muted-foreground">
              Gerencie suas campanhas e grupos de WhatsApp
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nova Campanha
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Nova Campanha</DialogTitle>
                <DialogDescription>
                  Crie uma nova campanha vinculada a um grupo de WhatsApp
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome da Campanha</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        nome: e.target.value,
                        grupo_id: formData.grupo_id || generateSlug(e.target.value),
                      });
                    }}
                    placeholder="Ex: Black Friday 2024"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="grupo_id">ID do Grupo (slug)</Label>
                  <Input
                    id="grupo_id"
                    value={formData.grupo_id}
                    onChange={(e) =>
                      setFormData({ ...formData, grupo_id: e.target.value })
                    }
                    placeholder="Ex: black-friday-2024"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Será usado na URL: /entrar/{formData.grupo_id || "slug"}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="link_grupo">Link do Grupo WhatsApp</Label>
                  <Input
                    id="link_grupo"
                    value={formData.link_grupo}
                    onChange={(e) =>
                      setFormData({ ...formData, link_grupo: e.target.value })
                    }
                    placeholder="https://chat.whatsapp.com/..."
                    required
                  />
                </div>

                {/* Seleção de Instância e Grupo */}
                <div className="p-4 border rounded-lg space-y-4 bg-muted/50">
                  <div className="space-y-2">
                    <Label htmlFor="instancia">Instância WhatsApp</Label>
                    <Select
                      value={formData.instancia_id}
                      onValueChange={(value) => 
                        setFormData({ 
                          ...formData, 
                          instancia_id: value,
                          grupo_selecionado_id: "",
                          whatsapp_group_jid: "",
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma instância" />
                      </SelectTrigger>
                      <SelectContent>
                        {instancias.length === 0 ? (
                          <SelectItem value="_none" disabled>
                            Nenhuma instância conectada
                          </SelectItem>
                        ) : (
                          instancias.map((inst) => (
                            <SelectItem key={inst.id} value={inst.id}>
                              {inst.nome}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {instancias.length === 0 && (
                      <p className="text-xs text-amber-600">
                        Conecte uma instância em "Instâncias" primeiro
                      </p>
                    )}
                  </div>

                  {formData.instancia_id && (
                    <div className="space-y-2">
                      <Label htmlFor="grupo">Grupo do WhatsApp</Label>
                      <Select
                        value={formData.grupo_selecionado_id}
                        onValueChange={handleGrupoChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um grupo" />
                        </SelectTrigger>
                        <SelectContent>
                          {grupos.length === 0 ? (
                            <SelectItem value="_none" disabled>
                              Nenhum grupo sincronizado
                            </SelectItem>
                          ) : (
                            grupos.map((grupo) => (
                              <SelectItem key={grupo.id} value={grupo.id}>
                                {grupo.group_name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      {grupos.length === 0 && (
                        <p className="text-xs text-amber-600">
                          Sincronize os grupos na página "Instâncias"
                        </p>
                      )}
                    </div>
                  )}

                  {formData.whatsapp_group_jid && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">JID do Grupo (automático)</Label>
                      <code className="block text-xs bg-background p-2 rounded border">
                        {formData.whatsapp_group_jid}
                      </code>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="descricao">Descrição (opcional)</Label>
                  <Textarea
                    id="descricao"
                    value={formData.descricao}
                    onChange={(e) =>
                      setFormData({ ...formData, descricao: e.target.value })
                    }
                    placeholder="Descrição que aparecerá na landing page"
                  />
                </div>

                <Button type="submit" className="w-full" disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    "Criar Campanha"
                  )}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Suas Campanhas</CardTitle>
            <CardDescription>
              Cada campanha gera um link único para usar nos anúncios
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : campanhas.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Nenhuma campanha criada ainda</p>
                <p className="text-sm">Clique em "Nova Campanha" para começar</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>JID do Grupo</TableHead>
                    <TableHead>Link para Anúncios</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campanhas.map((campanha) => (
                    <TableRow key={campanha.id}>
                      <TableCell className="font-medium">
                        {campanha.nome}
                      </TableCell>
                      <TableCell>
                        {campanha.whatsapp_group_jid ? (
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {campanha.whatsapp_group_jid.length > 20 
                              ? `${campanha.whatsapp_group_jid.slice(0, 20)}...` 
                              : campanha.whatsapp_group_jid}
                          </code>
                        ) : (
                          <span className="text-xs text-amber-600">Não configurado</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          /entrar/{campanha.grupo_id}
                        </code>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={campanha.ativo}
                            onCheckedChange={(checked) =>
                              toggleAtivo(campanha.id, checked)
                            }
                          />
                          <Badge variant={campanha.ativo ? "default" : "secondary"}>
                            {campanha.ativo ? "Ativo" : "Inativo"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyLink(campanha.grupo_id)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              window.open(`/entrar/${campanha.grupo_id}`, "_blank")
                            }
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteCampanha(campanha.id)}
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

export default Campanhas;

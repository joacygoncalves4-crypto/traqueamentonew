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
import { Plus, Copy, Trash2, Loader2, ExternalLink, MessageCircle, Pencil } from "lucide-react";
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
  pixel_id: string | null;
  telegram_chat_id: string | null;
  telegram_bot_id: string | null;
  tipo_destino: string | null;
  numero_whatsapp: string | null;
  ativo: boolean;
  created_at: string;
}

interface Pixel {
  id: string;
  nome: string;
  pixel_id: string;
  ativo: boolean;
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

interface TelegramBot {
  id: string;
  nome: string;
  bot_username: string | null;
  status: string | null;
}

const Campanhas = () => {
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [instancias, setInstancias] = useState<Instancia[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [pixels, setPixels] = useState<Pixel[]>([]);
  const [telegramBots, setTelegramBots] = useState<TelegramBot[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingCampanha, setEditingCampanha] = useState<Campanha | null>(null);
  const [formData, setFormData] = useState({
    nome: "",
    descricao: "",
    link_grupo: "",
    grupo_id: "",
    whatsapp_group_jid: "",
    instancia_id: "",
    grupo_selecionado_id: "",
    pixel_id: "",
    telegram_chat_id: "",
    telegram_bot_id: "",
    tipo_destino: "grupo",
    numero_whatsapp: "",
  });

  useEffect(() => {
    fetchCampanhas();
    fetchInstancias();
    fetchPixels();
    fetchTelegramBots();
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

  const fetchPixels = async () => {
    const { data, error } = await supabase
      .from("pixels")
      .select("id, nome, pixel_id, ativo")
      .eq("ativo", true)
      .order("nome");

    if (error) {
      console.error("Erro ao buscar pixels:", error);
    } else {
      setPixels(data || []);
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

  const fetchTelegramBots = async () => {
    const { data, error } = await supabase
      .from("telegram_bots")
      .select("id, nome, bot_username, status")
      .eq("status", "connected")
      .order("nome");

    if (error) {
      console.error("Erro ao buscar bots Telegram:", error);
    } else {
      setTelegramBots(data || []);
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
      pixel_id: formData.pixel_id || null,
      telegram_chat_id: formData.telegram_chat_id || null,
      telegram_bot_id: formData.telegram_bot_id || null,
      tipo_destino: formData.tipo_destino || "grupo",
      numero_whatsapp: formData.numero_whatsapp || null,
    });

    if (error) {
      console.error("Erro ao criar campanha:", error);
      toast.error("Erro ao criar campanha. Verifique se o ID do grupo já existe.");
    } else {
      toast.success("Campanha criada com sucesso!");
      setDialogOpen(false);
      resetForm();
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
    toast.success("Link da landing page copiado!");
  };

  const copyWhatsAppLink = (linkGrupo: string) => {
    navigator.clipboard.writeText(linkGrupo);
    toast.success("Link do WhatsApp copiado!");
  };

  const openEditDialog = async (campanha: Campanha) => {
    setEditingCampanha(campanha);
    
    // Se a campanha tem instancia_id, buscar os grupos dessa instância
    if (campanha.instancia_id) {
      await fetchGrupos(campanha.instancia_id);
    }
    
    setFormData({
      nome: campanha.nome,
      descricao: campanha.descricao || "",
      link_grupo: campanha.link_grupo,
      grupo_id: campanha.grupo_id,
      whatsapp_group_jid: campanha.whatsapp_group_jid || "",
      instancia_id: campanha.instancia_id || "",
      grupo_selecionado_id: "",
      pixel_id: campanha.pixel_id || "",
      telegram_chat_id: campanha.telegram_chat_id || "",
      telegram_bot_id: campanha.telegram_bot_id || "",
      tipo_destino: campanha.tipo_destino || "grupo",
      numero_whatsapp: campanha.numero_whatsapp || "",
    });
    setEditDialogOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCampanha) return;
    
    setSaving(true);

    const { error } = await supabase
      .from("campanhas")
      .update({
        nome: formData.nome,
        descricao: formData.descricao || null,
        link_grupo: formData.link_grupo,
        grupo_id: formData.grupo_id,
        whatsapp_group_jid: formData.whatsapp_group_jid || null,
        instancia_id: formData.instancia_id || null,
        pixel_id: formData.pixel_id || null,
        telegram_chat_id: formData.telegram_chat_id || null,
        telegram_bot_id: formData.telegram_bot_id || null,
        tipo_destino: formData.tipo_destino || "grupo",
        numero_whatsapp: formData.numero_whatsapp || null,
      })
      .eq("id", editingCampanha.id);

    if (error) {
      console.error("Erro ao atualizar campanha:", error);
      toast.error("Erro ao atualizar campanha");
    } else {
      toast.success("Campanha atualizada com sucesso!");
      setEditDialogOpen(false);
      setEditingCampanha(null);
      resetForm();
      fetchCampanhas();
    }
    setSaving(false);
  };

  const resetForm = () => {
    setFormData({
      nome: "",
      descricao: "",
      link_grupo: "",
      grupo_id: "",
      whatsapp_group_jid: "",
      instancia_id: "",
      grupo_selecionado_id: "",
      pixel_id: "",
      telegram_chat_id: "",
      telegram_bot_id: "",
      tipo_destino: "grupo",
      numero_whatsapp: "",
    });
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

                {/* Tipo de Destino */}
                <div className="space-y-2">
                  <Label htmlFor="tipo_destino">Tipo de Destino</Label>
                  <Select
                    value={formData.tipo_destino}
                    onValueChange={(value) =>
                      setFormData({ ...formData, tipo_destino: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="grupo">Grupo WhatsApp</SelectItem>
                      <SelectItem value="numero">Numero WhatsApp (conversa direta)</SelectItem>
                      <SelectItem value="telegram">Grupo/Canal Telegram</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Link do grupo (para grupo WPP e Telegram) */}
                {(formData.tipo_destino === "grupo" || formData.tipo_destino === "telegram") && (
                  <div className="space-y-2">
                    <Label htmlFor="link_grupo">
                      {formData.tipo_destino === "telegram" ? "Link do Canal Telegram" : "Link do Grupo WhatsApp"}
                    </Label>
                    <Input
                      id="link_grupo"
                      value={formData.link_grupo}
                      onChange={(e) =>
                        setFormData({ ...formData, link_grupo: e.target.value })
                      }
                      placeholder={formData.tipo_destino === "telegram" ? "https://t.me/..." : "https://chat.whatsapp.com/..."}
                      required
                    />
                  </div>
                )}

                {/* Numero WhatsApp (para conversa direta) */}
                {formData.tipo_destino === "numero" && (
                  <div className="space-y-2">
                    <Label htmlFor="numero_whatsapp">Numero do WhatsApp</Label>
                    <Input
                      id="numero_whatsapp"
                      value={formData.numero_whatsapp}
                      onChange={(e) =>
                        setFormData({ ...formData, numero_whatsapp: e.target.value, link_grupo: `https://wa.me/${e.target.value.replace(/\D/g, "")}` })
                      }
                      placeholder="5511999999999"
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Formato: codigo do pais + DDD + numero (sem espacos ou sinais)
                    </p>
                  </div>
                )}

                {/* Seleção de Pixel */}
                <div className="space-y-2">
                  <Label htmlFor="pixel">Pixel do Facebook</Label>
                  <Select
                    value={formData.pixel_id}
                    onValueChange={(value) => 
                      setFormData({ ...formData, pixel_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um pixel" />
                    </SelectTrigger>
                    <SelectContent>
                      {pixels.length === 0 ? (
                        <SelectItem value="_none" disabled>
                          Nenhum pixel cadastrado
                        </SelectItem>
                      ) : (
                        pixels.map((pixel) => (
                          <SelectItem key={pixel.id} value={pixel.id}>
                            {pixel.nome} ({pixel.pixel_id})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {pixels.length === 0 && (
                    <p className="text-xs text-amber-600">
                      Cadastre um pixel em "Pixels" primeiro
                    </p>
                  )}
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

                {/* Seção Telegram */}
                <div className="p-4 border rounded-lg space-y-4 bg-muted/50">
                  <Label className="font-semibold">📱 Telegram (opcional)</Label>
                  <div className="space-y-2">
                    <Label htmlFor="telegram_bot">Bot do Telegram</Label>
                    <Select
                      value={formData.telegram_bot_id}
                      onValueChange={(value) => 
                        setFormData({ ...formData, telegram_bot_id: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um bot" />
                      </SelectTrigger>
                      <SelectContent>
                        {telegramBots.length === 0 ? (
                          <SelectItem value="_none" disabled>
                            Nenhum bot registrado
                          </SelectItem>
                        ) : (
                          telegramBots.map((bot) => (
                            <SelectItem key={bot.id} value={bot.id}>
                              {bot.nome} {bot.bot_username ? `(@${bot.bot_username})` : ""}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {telegramBots.length === 0 && (
                      <p className="text-xs text-amber-600">
                        Registre um bot em "Telegram" primeiro
                      </p>
                    )}
                  </div>

                  {formData.telegram_bot_id && (
                    <div className="space-y-2">
                      <Label htmlFor="telegram_chat_id">Chat ID do Canal/Grupo</Label>
                      <Input
                        id="telegram_chat_id"
                        value={formData.telegram_chat_id}
                        onChange={(e) =>
                          setFormData({ ...formData, telegram_chat_id: e.target.value })
                        }
                        placeholder="Ex: -1001234567890"
                      />
                      <p className="text-xs text-muted-foreground">
                        Use bots como @userinfobot para descobrir o Chat ID
                      </p>
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
                            onClick={() => copyWhatsAppLink(campanha.link_grupo)}
                            title="Copiar link do WhatsApp"
                          >
                            <MessageCircle className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyLink(campanha.grupo_id)}
                            title="Copiar link da landing page"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(campanha)}
                            title="Editar campanha"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteCampanha(campanha.id)}
                            title="Excluir campanha"
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

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) {
            setEditingCampanha(null);
            resetForm();
          }
        }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Editar Campanha</DialogTitle>
              <DialogDescription>
                Atualize os dados da campanha
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit_nome">Nome da Campanha</Label>
                <Input
                  id="edit_nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Ex: Black Friday 2024"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_grupo_id">ID do Grupo (slug)</Label>
                <Input
                  id="edit_grupo_id"
                  value={formData.grupo_id}
                  onChange={(e) => setFormData({ ...formData, grupo_id: e.target.value })}
                  placeholder="Ex: black-friday-2024"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_link_grupo">Link do Grupo WhatsApp</Label>
                <Input
                  id="edit_link_grupo"
                  value={formData.link_grupo}
                  onChange={(e) => setFormData({ ...formData, link_grupo: e.target.value })}
                  placeholder="https://chat.whatsapp.com/..."
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_pixel">Pixel do Facebook</Label>
                <Select
                  value={formData.pixel_id}
                  onValueChange={(value) => setFormData({ ...formData, pixel_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um pixel" />
                  </SelectTrigger>
                  <SelectContent>
                    {pixels.map((pixel) => (
                      <SelectItem key={pixel.id} value={pixel.id}>
                        {pixel.nome} ({pixel.pixel_id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="p-4 border rounded-lg space-y-4 bg-muted/50">
                <div className="space-y-2">
                  <Label htmlFor="edit_instancia">Instância WhatsApp</Label>
                  <Select
                    value={formData.instancia_id}
                    onValueChange={(value) => {
                      setFormData({ 
                        ...formData, 
                        instancia_id: value,
                        grupo_selecionado_id: "",
                        whatsapp_group_jid: "",
                      });
                      fetchGrupos(value);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma instância" />
                    </SelectTrigger>
                    <SelectContent>
                      {instancias.map((inst) => (
                        <SelectItem key={inst.id} value={inst.id}>
                          {inst.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {formData.instancia_id && (
                  <div className="space-y-2">
                    <Label htmlFor="edit_grupo">Grupo do WhatsApp</Label>
                    <Select
                      value={formData.grupo_selecionado_id}
                      onValueChange={handleGrupoChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um grupo" />
                      </SelectTrigger>
                      <SelectContent>
                        {grupos.map((grupo) => (
                          <SelectItem key={grupo.id} value={grupo.id}>
                            {grupo.group_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {formData.whatsapp_group_jid && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">JID do Grupo</Label>
                    <code className="block text-xs bg-background p-2 rounded border">
                      {formData.whatsapp_group_jid}
                    </code>
                  </div>
                )}
              </div>

              {/* Seção Telegram (edição) */}
              <div className="p-4 border rounded-lg space-y-4 bg-muted/50">
                <Label className="font-semibold">📱 Telegram (opcional)</Label>
                <div className="space-y-2">
                  <Label htmlFor="edit_telegram_bot">Bot do Telegram</Label>
                  <Select
                    value={formData.telegram_bot_id}
                    onValueChange={(value) => 
                      setFormData({ ...formData, telegram_bot_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um bot" />
                    </SelectTrigger>
                    <SelectContent>
                      {telegramBots.map((bot) => (
                        <SelectItem key={bot.id} value={bot.id}>
                          {bot.nome} {bot.bot_username ? `(@${bot.bot_username})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {formData.telegram_bot_id && (
                  <div className="space-y-2">
                    <Label htmlFor="edit_telegram_chat_id">Chat ID do Canal/Grupo</Label>
                    <Input
                      id="edit_telegram_chat_id"
                      value={formData.telegram_chat_id}
                      onChange={(e) =>
                        setFormData({ ...formData, telegram_chat_id: e.target.value })
                      }
                      placeholder="Ex: -1001234567890"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_descricao">Descrição (opcional)</Label>
                <Textarea
                  id="edit_descricao"
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
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
                  "Salvar Alterações"
                )}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default Campanhas;

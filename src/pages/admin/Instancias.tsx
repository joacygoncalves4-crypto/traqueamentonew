import { useState, useEffect, useRef } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Plus,
  RefreshCw,
  Trash2,
  Smartphone,
  Loader2,
  QrCode,
  Users,
  Wifi,
  WifiOff,
  Signal,
  Download,
} from "lucide-react";

interface Instancia {
  id: string;
  nome: string;
  api_url: string;
  api_key: string;
  instance_name: string;
  numero_whatsapp: string | null;
  status: string;
  created_at: string;
  grupos_count?: number;
}

interface Grupo {
  id: string;
  group_jid: string;
  group_name: string;
  group_size: number;
}

// Formata número de telefone para exibição
const formatPhoneNumber = (phone: string | null): string => {
  if (!phone) return "Não identificado";
  
  // Remove caracteres não numéricos
  const cleaned = phone.replace(/\D/g, "");
  
  // Formato brasileiro: +55 XX XXXXX-XXXX
  if (cleaned.length === 13 && cleaned.startsWith("55")) {
    return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
  }
  // Formato brasileiro sem 9: +55 XX XXXX-XXXX
  if (cleaned.length === 12 && cleaned.startsWith("55")) {
    return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 8)}-${cleaned.slice(8)}`;
  }
  // Retorna formatado com + se tiver mais de 10 dígitos
  if (cleaned.length > 10) {
    return `+${cleaned}`;
  }
  return phone;
};

const Instancias = () => {
  const { toast } = useToast();
  const [instancias, setInstancias] = useState<Instancia[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [gruposDialogOpen, setGruposDialogOpen] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [checking, setChecking] = useState<string | null>(null);
  
  // New connection dialog
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [nome, setNome] = useState("");
  
  // QR Code state
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [currentInstancia, setCurrentInstancia] = useState<Instancia | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  
  // Grupos state
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [gruposLoading, setGruposLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    fetchInstancias();
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  const fetchInstancias = async () => {
    try {
      const { data: instanciasData, error } = await supabase
        .from("evolution_instancias")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Buscar contagem de grupos para cada instância
      const instanciasComGrupos = await Promise.all(
        (instanciasData || []).map(async (inst) => {
          const { count } = await supabase
            .from("evolution_grupos")
            .select("*", { count: "exact", head: true })
            .eq("instancia_id", inst.id);
          
          return { ...inst, grupos_count: count || 0 };
        })
      );

      setInstancias(instanciasComGrupos);
    } catch (error: any) {
      console.error("Erro ao buscar instâncias:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as instâncias",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateInstanceName = (name: string) => {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  };

  const connectNewNumber = async () => {
    if (!nome.trim()) {
      toast({
        title: "Erro",
        description: "Digite um nome para identificar este número",
        variant: "destructive",
      });
      return;
    }

    setConnecting(true);
    const instanceName = generateInstanceName(nome) + "-" + Date.now();

    try {
      // Salvar no banco primeiro
      const { data: newInstancia, error: dbError } = await supabase
        .from("evolution_instancias")
        .insert({
          nome,
          api_url: "from_env",
          api_key: "from_env",
          instance_name: instanceName,
          status: "disconnected",
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // Criar instância na Evolution API
      const { data, error } = await supabase.functions.invoke("evolution-api", {
        body: {
          action: "create",
          instance_name: instanceName,
        },
      });

      if (error) throw error;

      if (!data.success) {
        // Se falhou, deletar do banco
        await supabase.from("evolution_instancias").delete().eq("id", newInstancia.id);
        throw new Error(data.error || "Erro ao criar instância na Evolution");
      }

      // Configurar webhook automaticamente
      const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-evolution`;
      await supabase.functions.invoke("evolution-api", {
        body: {
          action: "webhook",
          instance_name: instanceName,
          webhook_url: webhookUrl,
        },
      });

      setNewDialogOpen(false);
      setCurrentInstancia(newInstancia);
      setQrDialogOpen(true);
      
      // Buscar QR Code
      await fetchQrCode(newInstancia);
      
      // Iniciar polling para verificar conexão
      startPolling(newInstancia);

      toast({
        title: "Sucesso",
        description: "Escaneie o QR Code para conectar!",
      });

      setNome("");
      fetchInstancias();
    } catch (error: any) {
      console.error("Erro ao conectar número:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível conectar",
        variant: "destructive",
      });
    } finally {
      setConnecting(false);
    }
  };

  const fetchQrCode = async (instancia: Instancia) => {
    setQrLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("evolution-api", {
        body: {
          action: "connect",
          instance_name: instancia.instance_name,
        },
      });

      if (error) throw error;

      const qrBase64 = data.data?.base64 || data.data?.qrcode?.base64;
      if (qrBase64) {
        setQrCode(qrBase64);
      } else if (data.data?.instance?.state === "open") {
        handleConnected(instancia);
      }
    } catch (error: any) {
      console.error("Erro ao buscar QR Code:", error);
      toast({
        title: "Erro",
        description: "Não foi possível gerar o QR Code",
        variant: "destructive",
      });
    } finally {
      setQrLoading(false);
    }
  };

  const checkConnectionStatus = async (instancia: Instancia) => {
    try {
      const { data, error } = await supabase.functions.invoke("evolution-api", {
        body: {
          action: "status",
          instance_name: instancia.instance_name,
        },
      });

      if (error) throw error;

      const state = data.data?.state || data.data?.instance?.state;
      if (state === "open") {
        handleConnected(instancia, data.phoneNumber);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Erro ao verificar status:", error);
      return false;
    }
  };

  const handleConnected = async (instancia: Instancia, phoneNumber?: string) => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    await supabase
      .from("evolution_instancias")
      .update({
        status: "connected",
        numero_whatsapp: phoneNumber || null,
      })
      .eq("id", instancia.id);

    setQrDialogOpen(false);
    setQrCode(null);
    setCurrentInstancia(null);

    toast({
      title: "Conectado!",
      description: phoneNumber 
        ? `WhatsApp ${phoneNumber} conectado com sucesso!` 
        : "WhatsApp conectado com sucesso!",
    });

    fetchInstancias();
  };

  const startPolling = (instancia: Instancia) => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }

    pollingRef.current = setInterval(async () => {
      const connected = await checkConnectionStatus(instancia);
      if (connected) {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      }
    }, 3000);
  };

  const reconnect = async (instancia: Instancia) => {
    setCurrentInstancia(instancia);
    setQrDialogOpen(true);
    await fetchQrCode(instancia);
    
    // Configurar webhook ao reconectar
    const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-evolution`;
    await supabase.functions.invoke("evolution-api", {
      body: {
        action: "webhook",
        instance_name: instancia.instance_name,
        webhook_url: webhookUrl,
      },
    });
    
    startPolling(instancia);
  };

  // Função para verificar conexão manualmente
  const checkAndUpdateStatus = async (instancia: Instancia) => {
    setChecking(instancia.id);
    try {
      const { data, error } = await supabase.functions.invoke("evolution-api", {
        body: {
          action: "status",
          instance_name: instancia.instance_name,
        },
      });

      if (error) throw error;

      const state = data.data?.state || data.data?.instance?.state;
      const phoneNumber = data.phoneNumber;

      if (state === "open") {
        // Atualizar como conectado
        await supabase
          .from("evolution_instancias")
          .update({
            status: "connected",
            numero_whatsapp: phoneNumber || instancia.numero_whatsapp,
          })
          .eq("id", instancia.id);

        toast({
          title: "✅ Conectado!",
          description: phoneNumber 
            ? `WhatsApp ${formatPhoneNumber(phoneNumber)} está online` 
            : "WhatsApp está online",
        });
      } else {
        // Atualizar como desconectado
        await supabase
          .from("evolution_instancias")
          .update({ status: "disconnected" })
          .eq("id", instancia.id);

        toast({
          title: "⚠️ Desconectado",
          description: "O WhatsApp não está conectado. Clique em Reconectar para gerar um novo QR Code.",
          variant: "destructive",
        });
      }

      fetchInstancias();
    } catch (error: any) {
      console.error("Erro ao verificar conexão:", error);
      toast({
        title: "Erro",
        description: "Não foi possível verificar a conexão",
        variant: "destructive",
      });
    } finally {
      setChecking(null);
    }
  };

  const syncGrupos = async (instancia: Instancia) => {
    setSyncing(instancia.id);
    try {
      const { data, error } = await supabase.functions.invoke("evolution-api", {
        body: {
          action: "groups",
          instance_name: instancia.instance_name,
        },
      });

      if (error) throw error;

      if (!data.success || !Array.isArray(data.data)) {
        throw new Error("Formato de resposta inválido");
      }

      await supabase
        .from("evolution_grupos")
        .delete()
        .eq("instancia_id", instancia.id);

      const gruposToInsert = data.data.map((group: any) => ({
        instancia_id: instancia.id,
        group_jid: group.id,
        group_name: group.subject || group.name || "Sem nome",
        group_size: group.size || 0,
      }));

      if (gruposToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from("evolution_grupos")
          .insert(gruposToInsert);

        if (insertError) throw insertError;
      }

      toast({
        title: "Sucesso",
        description: `${gruposToInsert.length} grupos sincronizados!`,
      });

      fetchInstancias();
    } catch (error: any) {
      console.error("Erro ao sincronizar grupos:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível sincronizar os grupos",
        variant: "destructive",
      });
    } finally {
      setSyncing(null);
    }
  };

  const viewGrupos = async (instancia: Instancia) => {
    setGruposLoading(true);
    setCurrentInstancia(instancia);
    setGruposDialogOpen(true);

    try {
      const { data, error } = await supabase
        .from("evolution_grupos")
        .select("*")
        .eq("instancia_id", instancia.id)
        .order("group_name");

      if (error) throw error;
      setGrupos(data || []);
    } catch (error: any) {
      console.error("Erro ao buscar grupos:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os grupos",
        variant: "destructive",
      });
    } finally {
      setGruposLoading(false);
    }
  };

  const deleteInstancia = async (instancia: Instancia) => {
    if (!confirm(`Tem certeza que deseja excluir "${instancia.nome}"?`)) {
      return;
    }

    try {
      await supabase.functions.invoke("evolution-api", {
        body: {
          action: "delete",
          instance_name: instancia.instance_name,
        },
      });

      const { error } = await supabase
        .from("evolution_instancias")
        .delete()
        .eq("id", instancia.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Número excluído!",
      });

      fetchInstancias();
    } catch (error: any) {
      console.error("Erro ao excluir:", error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir",
        variant: "destructive",
      });
    }
  };

  const closeQrDialog = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setQrDialogOpen(false);
    setQrCode(null);
    setCurrentInstancia(null);
  };

  const importFromEvolution = async () => {
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("evolution-api", {
        body: { action: "fetchInstances" },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Erro ao buscar instâncias");

      const remoteInstances: { instanceName: string; state: string; phone: string | null }[] = data.data || [];

      if (remoteInstances.length === 0) {
        toast({ title: "Nenhuma instância encontrada na Evolution API" });
        return;
      }

      // Get existing instance names
      const { data: existing } = await supabase
        .from("evolution_instancias")
        .select("instance_name");
      const existingNames = new Set((existing || []).map((e) => e.instance_name));

      const toImport = remoteInstances.filter((r) => r.instanceName && !existingNames.has(r.instanceName));

      if (toImport.length === 0) {
        toast({ title: "Todas as instâncias já estão importadas!" });
        return;
      }

      const rows = toImport.map((inst) => ({
        nome: inst.instanceName,
        api_url: "from_env",
        api_key: "from_env",
        instance_name: inst.instanceName,
        status: inst.state === "open" ? "connected" : "disconnected",
        numero_whatsapp: inst.phone || null,
      }));

      const { error: insertError } = await supabase.from("evolution_instancias").insert(rows);
      if (insertError) throw insertError;

      // Configure webhook for each imported instance
      const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-evolution`;
      for (const inst of toImport) {
        await supabase.functions.invoke("evolution-api", {
          body: { action: "webhook", instance_name: inst.instanceName, webhook_url: webhookUrl },
        }).catch(() => {});
      }

      toast({
        title: "Sucesso",
        description: `${toImport.length} instância(s) importada(s)!`,
      });

      fetchInstancias();
    } catch (error: any) {
      console.error("Erro ao importar:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível importar as instâncias",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">WhatsApp</h1>
            <p className="text-muted-foreground">
              Conecte seus números de WhatsApp
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={importFromEvolution} disabled={importing}>
              {importing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Importar da Evolution
            </Button>
            <Button onClick={() => setNewDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Conectar Número
            </Button>
          </div>
        </div>

        {/* New Connection Dialog - Simplified */}
        <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                Conectar Novo Número
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome para identificar</Label>
                <Input
                  id="nome"
                  placeholder="Ex: WhatsApp Vendas"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && connectNewNumber()}
                />
              </div>
              <Button
                className="w-full"
                onClick={connectNewNumber}
                disabled={connecting}
              >
                {connecting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Gerando QR Code...
                  </>
                ) : (
                  <>
                    <QrCode className="h-4 w-4 mr-2" />
                    Gerar QR Code
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* QR Code Dialog */}
        <Dialog open={qrDialogOpen} onOpenChange={closeQrDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                Conectar WhatsApp
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4 py-4">
              {qrLoading ? (
                <div className="w-64 h-64 flex items-center justify-center bg-muted rounded-lg">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : qrCode ? (
                <>
                  <div className="bg-white p-4 rounded-lg">
                    <img
                      src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`}
                      alt="QR Code"
                      className="w-56 h-56"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground text-center">
                    Abra o WhatsApp → <strong>Dispositivos Conectados</strong> → Escaneie
                  </p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Aguardando conexão...
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => currentInstancia && fetchQrCode(currentInstancia)}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Atualizar QR Code
                  </Button>
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">QR Code não disponível</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => currentInstancia && fetchQrCode(currentInstancia)}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Tentar Novamente
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Grupos Dialog */}
        <Dialog open={gruposDialogOpen} onOpenChange={setGruposDialogOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Grupos - {currentInstancia?.nome}
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              {gruposLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : grupos.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum grupo sincronizado. Clique em "Sincronizar" primeiro.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome do Grupo</TableHead>
                      <TableHead>JID</TableHead>
                      <TableHead className="text-right">Participantes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {grupos.map((grupo) => (
                      <TableRow key={grupo.id}>
                        <TableCell className="font-medium">{grupo.group_name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">
                          {grupo.group_jid}
                        </TableCell>
                        <TableCell className="text-right">{grupo.group_size}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Table */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Número</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Grupos</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : instancias.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum número conectado. Clique em "Conectar Número" para começar.
                  </TableCell>
                </TableRow>
              ) : (
                instancias.map((instancia) => (
                  <TableRow key={instancia.id}>
                    <TableCell>
                      <div className="font-medium">{instancia.nome}</div>
                    </TableCell>
                    <TableCell>
                      <span className={instancia.numero_whatsapp ? "font-mono text-sm" : "text-muted-foreground italic"}>
                        {formatPhoneNumber(instancia.numero_whatsapp)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {instancia.status === "connected" ? (
                        <Badge variant="default" className="bg-green-600">
                          <Wifi className="h-3 w-3 mr-1" />
                          Conectado
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <WifiOff className="h-3 w-3 mr-1" />
                          Desconectado
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => viewGrupos(instancia)}
                      >
                        <Users className="h-4 w-4 mr-1" />
                        {instancia.grupos_count || 0}
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <TooltipProvider>
                        <div className="flex items-center justify-end gap-1">
                          {instancia.status !== "connected" && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => reconnect(instancia)}
                                >
                                  <QrCode className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Reconectar</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => checkAndUpdateStatus(instancia)}
                                disabled={checking === instancia.id}
                              >
                                {checking === instancia.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Signal className="h-4 w-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Verificar Conexão</p>
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => syncGrupos(instancia)}
                                disabled={syncing === instancia.id || instancia.status !== "connected"}
                              >
                                {syncing === instancia.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-4 w-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Sincronizar Grupos</p>
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => deleteInstancia(instancia)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Excluir Instância</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TooltipProvider>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminLayout>
  );
};

export default Instancias;
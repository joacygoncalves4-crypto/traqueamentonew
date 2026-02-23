import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Loader2, RefreshCw, Bot, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface TelegramBot {
  id: string;
  nome: string;
  bot_token: string;
  bot_username: string | null;
  status: string | null;
  created_at: string;
}

const Telegram = () => {
  const [bots, setBots] = useState<TelegramBot[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [botToken, setBotToken] = useState("");

  useEffect(() => {
    fetchBots();
  }, []);

  const fetchBots = async () => {
    const { data, error } = await supabase
      .from("telegram_bots")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao buscar bots:", error);
      toast.error("Erro ao carregar bots");
    } else {
      setBots(data || []);
    }
    setLoading(false);
  };

  const registerBot = async () => {
    if (!nome.trim() || !botToken.trim()) {
      toast.error("Preencha o nome e o token do bot");
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("telegram-api", {
        body: { action: "register", bot_token: botToken, nome },
      });

      if (error) throw error;

      if (!data.success) {
        toast.error(data.error || "Erro ao registrar bot");
        return;
      }

      toast.success(`Bot @${data.bot.username} registrado com sucesso!`);
      setDialogOpen(false);
      setNome("");
      setBotToken("");
      fetchBots();
    } catch (error: any) {
      console.error("Erro ao registrar bot:", error);
      toast.error(error.message || "Erro ao registrar bot");
    } finally {
      setSaving(false);
    }
  };

  const checkStatus = async (bot: TelegramBot) => {
    setChecking(bot.id);
    try {
      const { data, error } = await supabase.functions.invoke("telegram-api", {
        body: { action: "status", bot_id: bot.id },
      });

      if (error) throw error;

      if (data.status === "connected") {
        toast.success(`Bot @${bot.bot_username} está conectado!`);
      } else {
        toast.error(`Bot @${bot.bot_username} está desconectado`);
      }

      fetchBots();
    } catch (error: any) {
      toast.error("Erro ao verificar status");
    } finally {
      setChecking(null);
    }
  };

  const deleteBot = async (bot: TelegramBot) => {
    if (!confirm(`Excluir o bot "${bot.nome}"? Isso removerá o webhook e desvinculará campanhas.`)) return;

    try {
      const { data, error } = await supabase.functions.invoke("telegram-api", {
        body: { action: "delete", bot_id: bot.id },
      });

      if (error) throw error;

      toast.success("Bot removido com sucesso");
      fetchBots();
    } catch (error: any) {
      toast.error("Erro ao excluir bot");
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Telegram Bots</h1>
            <p className="text-muted-foreground">
              Gerencie seus bots do Telegram para rastrear entradas em canais e grupos
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Novo Bot
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registrar Bot do Telegram</DialogTitle>
                <DialogDescription>
                  Cole o token que você recebeu do @BotFather. O webhook será configurado automaticamente.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="bot_nome">Nome do Bot</Label>
                  <Input
                    id="bot_nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex: Bot Rastreador"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bot_token">Token do Bot</Label>
                  <Input
                    id="bot_token"
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                    type="password"
                  />
                  <p className="text-xs text-muted-foreground">
                    Obtenha o token no @BotFather do Telegram
                  </p>
                </div>
                <Button onClick={registerBot} className="w-full" disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Registrando...
                    </>
                  ) : (
                    "Registrar Bot"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Seus Bots</CardTitle>
            <CardDescription>
              Adicione o bot como administrador no canal/grupo para rastrear entradas
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : bots.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum bot registrado ainda</p>
                <p className="text-sm">Clique em "Novo Bot" para começar</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bots.map((bot) => (
                    <TableRow key={bot.id}>
                      <TableCell className="font-medium">{bot.nome}</TableCell>
                      <TableCell>
                        {bot.bot_username ? (
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            @{bot.bot_username}
                          </code>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={bot.status === "connected" ? "default" : "secondary"}
                          className="flex items-center gap-1 w-fit"
                        >
                          {bot.status === "connected" ? (
                            <Wifi className="h-3 w-3" />
                          ) : (
                            <WifiOff className="h-3 w-3" />
                          )}
                          {bot.status === "connected" ? "Conectado" : "Desconectado"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => checkStatus(bot)}
                            disabled={checking === bot.id}
                          >
                            {checking === bot.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteBot(bot)}
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

export default Telegram;

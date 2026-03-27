import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, Users, CheckCircle, Clock, Loader2, MousePointer, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import AdminLayout from "@/components/admin/AdminLayout";

interface Evento {
  id: string;
  telefone_masked: string;
  evento_enviado: boolean;
  fonte: string | null;
  fbc: string | null;
  utm_campaign: string | null;
  created_at: string;
  campanhas: {
    nome: string;
  } | null;
}

interface Campanha {
  id: string;
  nome: string;
}

interface AtribuicaoRow {
  utm_campaign: string;
  cliques: number;
  conversoes: number;
  com_fbc: number;
}

const Dashboard = () => {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [atribuicao, setAtribuicao] = useState<AtribuicaoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroCapanha, setFiltroCampanha] = useState<string>("all");
  const [stats, setStats] = useState({
    total: 0,
    hoje: 0,
    enviados: 0,
    cliques: 0,
  });

  useEffect(() => {
    fetchData();
  }, [filtroCapanha]);

  const fetchData = async () => {
    setLoading(true);

    // Buscar campanhas para o filtro
    const { data: campanhasData } = await supabase
      .from("campanhas")
      .select("id, nome")
      .order("nome");

    if (campanhasData) {
      setCampanhas(campanhasData);
    }

    // Buscar eventos (select * para compatibilidade com/sem migration)
    let query = supabase
      .from("eventos")
      .select(`
        *,
        campanhas (nome)
      `)
      .order("created_at", { ascending: false })
      .limit(100);

    if (filtroCapanha && filtroCapanha !== "all") {
      query = query.eq("campanha_id", filtroCapanha);
    }

    const { data: eventosData, error } = await query;

    if (error) {
      console.error("Erro ao buscar eventos:", error);
    } else if (eventosData) {
      setEventos(eventosData);

      // Calcular stats
      const hoje = new Date().toDateString();
      const eventosHoje = eventosData.filter(
        (e) => new Date(e.created_at).toDateString() === hoje
      );
      const enviados = eventosData.filter((e) => e.evento_enviado);

      // Buscar total de cliques
      const { count: totalCliques } = await supabase
        .from("cliques")
        .select("id", { count: "exact", head: true });

      setStats({
        total: eventosData.length,
        hoje: eventosHoje.length,
        enviados: enviados.length,
        cliques: totalCliques || 0,
      });
    }

    // Buscar dados de atribuicao por utm_campaign
    await fetchAtribuicao();

    setLoading(false);
  };

  const fetchAtribuicao = async () => {
    try {
      // Buscar cliques agrupados por utm_campaign
      const { data: cliques } = await supabase
        .from("cliques")
        .select("utm_campaign")
        .order("created_at", { ascending: false })
        .limit(500);

      // Buscar eventos com atribuicao
      const { data: eventosAttr } = await supabase
        .from("eventos")
        .select("utm_campaign, fbc, evento_enviado")
        .limit(500);

      if (!cliques && !eventosAttr) return;

      // Agrupa por utm_campaign
      const map = new Map<string, AtribuicaoRow>();

      for (const click of cliques || []) {
        const key = click.utm_campaign || "(sem UTM)";
        if (!map.has(key)) {
          map.set(key, { utm_campaign: key, cliques: 0, conversoes: 0, com_fbc: 0 });
        }
        map.get(key)!.cliques++;
      }

      for (const evt of eventosAttr || []) {
        const key = evt.utm_campaign || "(sem UTM)";
        if (!map.has(key)) {
          map.set(key, { utm_campaign: key, cliques: 0, conversoes: 0, com_fbc: 0 });
        }
        const row = map.get(key)!;
        if (evt.evento_enviado) row.conversoes++;
        if (evt.fbc) row.com_fbc++;
      }

      setAtribuicao(Array.from(map.values()).sort((a, b) => b.cliques - a.cliques));
    } catch (err) {
      console.error("Erro ao buscar atribuicao:", err);
    }
  };

  const getFonteLabel = (fonte: string | null) => {
    switch (fonte) {
      case "whatsapp": return "WhatsApp";
      case "mensagem": return "Mensagem";
      case "telegram": return "Telegram";
      default: return "WhatsApp";
    }
  };

  const getFonteBadgeClass = (fonte: string | null) => {
    switch (fonte) {
      case "telegram": return "bg-blue-500";
      case "mensagem": return "bg-purple-500";
      default: return "bg-green-500";
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Acompanhe os eventos de entrada nos grupos e a qualidade das conversoes
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Leads</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Leads Hoje</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.hoje}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Eventos Enviados</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.enviados}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cliques na Landing</CardTitle>
              <MousePointer className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.cliques}</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabela de Atribuicao por UTM */}
        {atribuicao.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-500" />
                <div>
                  <CardTitle>Atribuicao por Campanha</CardTitle>
                  <CardDescription>Veja qual campanha do Facebook gera mais conversoes</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>utm_campaign</TableHead>
                    <TableHead className="text-center">Cliques</TableHead>
                    <TableHead className="text-center">Conversoes</TableHead>
                    <TableHead className="text-center">Com fbc</TableHead>
                    <TableHead className="text-center">Taxa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {atribuicao.map((row) => (
                    <TableRow key={row.utm_campaign}>
                      <TableCell className="font-medium">{row.utm_campaign}</TableCell>
                      <TableCell className="text-center">{row.cliques}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="default" className="bg-green-500">{row.conversoes}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {row.com_fbc > 0 ? (
                          <Badge variant="default" className="bg-blue-500">{row.com_fbc}</Badge>
                        ) : (
                          <Badge variant="secondary">0</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-mono">
                        {row.cliques > 0 ? `${Math.round((row.conversoes / row.cliques) * 100)}%` : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Tabela de Eventos */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Eventos Recentes</CardTitle>
                <CardDescription>Ultimos 100 eventos de entrada</CardDescription>
              </div>
              <Select value={filtroCapanha} onValueChange={setFiltroCampanha}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filtrar por campanha" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as campanhas</SelectItem>
                  {campanhas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : eventos.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum evento registrado ainda</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Campanha</TableHead>
                    <TableHead>Fonte</TableHead>
                    <TableHead>Atribuicao</TableHead>
                    <TableHead>Status Pixel</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eventos.map((evento) => (
                    <TableRow key={evento.id}>
                      <TableCell>
                        {format(new Date(evento.created_at), "dd/MM/yyyy HH:mm", {
                          locale: ptBR,
                        })}
                      </TableCell>
                      <TableCell className="font-mono">
                        {evento.telefone_masked}
                      </TableCell>
                      <TableCell>{evento.campanhas?.nome || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="default" className={getFonteBadgeClass(evento.fonte)}>
                          {getFonteLabel(evento.fonte)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {evento.fbc ? (
                          <Badge variant="default" className="bg-blue-500">fbc</Badge>
                        ) : (
                          <Badge variant="secondary">sem fbc</Badge>
                        )}
                        {evento.utm_campaign && (
                          <span className="ml-1 text-xs text-muted-foreground">{evento.utm_campaign}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {evento.evento_enviado ? (
                          <Badge variant="default" className="bg-green-500">
                            Enviado
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Pendente</Badge>
                        )}
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

export default Dashboard;

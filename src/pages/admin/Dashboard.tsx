import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, Users, CheckCircle, Clock, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import AdminLayout from "@/components/admin/AdminLayout";

interface Evento {
  id: string;
  telefone_masked: string;
  evento_enviado: boolean;
  created_at: string;
  campanhas: {
    nome: string;
  } | null;
}

interface Campanha {
  id: string;
  nome: string;
}

const Dashboard = () => {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroCapanha, setFiltroCampanha] = useState<string>("all");
  const [stats, setStats] = useState({
    total: 0,
    hoje: 0,
    enviados: 0,
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

    // Buscar eventos
    let query = supabase
      .from("eventos")
      .select(`
        id,
        telefone_masked,
        evento_enviado,
        created_at,
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

      setStats({
        total: eventosData.length,
        hoje: eventosHoje.length,
        enviados: enviados.length,
      });
    }

    setLoading(false);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Acompanhe os eventos de entrada nos grupos
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
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
        </div>

        {/* Tabela de Eventos */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Eventos Recentes</CardTitle>
                <CardDescription>Últimos 100 eventos de entrada</CardDescription>
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

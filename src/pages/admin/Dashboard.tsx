import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { BarChart3, Users, CheckCircle, Clock, Loader2, MousePointer, TrendingUp, Zap, RefreshCw, Calendar } from "lucide-react";
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

interface CampanhaRealtime {
  nome: string;
  hoje_total: number;
  hoje_ads: number;
  hoje_direto: number;
  ultimas24h_total: number;
  ultimas24h_ads: number;
}

interface CampanhaLeads {
  nome: string;
  total_unicos: number;
  via_anuncio: number;
  direto: number;
  pct_anuncio: number;
}

const Dashboard = () => {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [atribuicao, setAtribuicao] = useState<AtribuicaoRow[]>([]);
  const [campanhaRealtime, setCampanhaRealtime] = useState<CampanhaRealtime[]>([]);
  const [campanhaLeads, setCampanhaLeads] = useState<CampanhaLeads[]>([]);
  const [loading, setLoading] = useState(true);
  const [realtimeLoading, setRealtimeLoading] = useState(false);
  const [filtroCapanha, setFiltroCampanha] = useState<string>("all");
  const [periodo, setPeriodo] = useState<string>("hoje");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [stats, setStats] = useState({
    total: 0,
    unicos: 0,
    hoje: 0,
    hojeUnicos: 0,
    enviados: 0,
    enviadosUnicos: 0,
    cliques: 0,
  });

  // Calcula range de data baseado no periodo selecionado
  const getDateRange = (): { start: string; end: string } => {
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    if (periodo === "custom" && dataInicio) {
      const start = new Date(dataInicio + "T00:00:00");
      const end = dataFim ? new Date(dataFim + "T23:59:59.999") : endOfDay;
      return { start: start.toISOString(), end: end.toISOString() };
    }

    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    switch (periodo) {
      case "hoje":
        return { start: startOfDay.toISOString(), end: endOfDay.toISOString() };
      case "ontem": {
        const ontemStart = new Date(startOfDay);
        ontemStart.setDate(ontemStart.getDate() - 1);
        return { start: ontemStart.toISOString(), end: startOfDay.toISOString() };
      }
      case "7dias": {
        const seteDias = new Date(startOfDay);
        seteDias.setDate(seteDias.getDate() - 7);
        return { start: seteDias.toISOString(), end: endOfDay.toISOString() };
      }
      case "30dias": {
        const trintaDias = new Date(startOfDay);
        trintaDias.setDate(trintaDias.getDate() - 30);
        return { start: trintaDias.toISOString(), end: endOfDay.toISOString() };
      }
      case "tudo":
        return { start: "2020-01-01T00:00:00.000Z", end: endOfDay.toISOString() };
      default:
        return { start: startOfDay.toISOString(), end: endOfDay.toISOString() };
    }
  };

  const getPeriodoLabel = (): string => {
    switch (periodo) {
      case "hoje": return "Hoje";
      case "ontem": return "Ontem";
      case "7dias": return "Ultimos 7 dias";
      case "30dias": return "Ultimos 30 dias";
      case "tudo": return "Todo o periodo";
      case "custom": return dataInicio ? `${dataInicio} a ${dataFim || "hoje"}` : "Personalizado";
      default: return "Hoje";
    }
  };

  useEffect(() => {
    fetchData();
    fetchRealtime();
  }, [filtroCapanha, periodo, dataInicio, dataFim]);

  // Auto-refresh a cada 60 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      fetchRealtime();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchRealtime = async () => {
    setRealtimeLoading(true);
    try {
      const { data: camps } = await supabase
        .from("campanhas")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");

      if (!camps || camps.length === 0) {
        setCampanhaRealtime([]);
        setRealtimeLoading(false);
        return;
      }

      const hojeStart = new Date();
      hojeStart.setHours(0, 0, 0, 0);
      const hojeIso = hojeStart.toISOString();
      const h24Ago = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { data: eventosRecentes } = await supabase
        .from("eventos")
        .select("campanha_id, fbc, evento_enviado, created_at, telefone_masked")
        .gte("created_at", h24Ago)
        .eq("fonte", "whatsapp")
        .eq("evento_enviado", true);

      const results: CampanhaRealtime[] = camps.map((camp) => {
        const eventsCamp = (eventosRecentes || []).filter(
          (e) => e.campanha_id === camp.id
        );

        // Deduplica por telefone
        const uniqueHoje = new Set<string>();
        const uniqueHojeAds = new Set<string>();
        const unique24h = new Set<string>();
        const unique24hAds = new Set<string>();

        for (const e of eventsCamp) {
          const tel = e.telefone_masked;
          unique24h.add(tel);
          if (e.fbc) unique24hAds.add(tel);

          if (e.created_at >= hojeIso) {
            uniqueHoje.add(tel);
            if (e.fbc) uniqueHojeAds.add(tel);
          }
        }

        return {
          nome: camp.nome,
          hoje_total: uniqueHoje.size,
          hoje_ads: uniqueHojeAds.size,
          hoje_direto: uniqueHoje.size - uniqueHojeAds.size,
          ultimas24h_total: unique24h.size,
          ultimas24h_ads: unique24hAds.size,
        };
      }).filter((r) => r.ultimas24h_total > 0);

      setCampanhaRealtime(results);
    } catch (err) {
      console.error("Erro ao buscar realtime:", err);
    }
    setRealtimeLoading(false);
  };

  const fetchData = async () => {
    setLoading(true);

    const { start, end } = getDateRange();

    // Buscar campanhas para o filtro
    const { data: campanhasData } = await supabase
      .from("campanhas")
      .select("id, nome")
      .order("nome");

    if (campanhasData) {
      setCampanhas(campanhasData);
    }

    // Buscar eventos no periodo selecionado
    let query = supabase
      .from("eventos")
      .select(`
        *,
        campanhas (nome)
      `)
      .gte("created_at", start)
      .lte("created_at", end)
      .order("created_at", { ascending: false })
      .limit(200);

    if (filtroCapanha && filtroCapanha !== "all") {
      query = query.eq("campanha_id", filtroCapanha);
    }

    const { data: eventosData, error } = await query;

    if (error) {
      console.error("Erro ao buscar eventos:", error);
    } else if (eventosData) {
      setEventos(eventosData);

      // Calcular stats com deduplicacao por telefone
      const telefonesUnicos = new Set(eventosData.map((e) => e.telefone_masked));
      const enviados = eventosData.filter((e) => e.evento_enviado);
      const enviadosUnicos = new Set(enviados.map((e) => e.telefone_masked));

      const hoje = new Date().toDateString();
      const eventosHoje = eventosData.filter(
        (e) => new Date(e.created_at).toDateString() === hoje
      );
      const hojeUnicos = new Set(eventosHoje.map((e) => e.telefone_masked));

      // Buscar total de cliques no periodo
      let cliquesQuery = supabase
        .from("cliques")
        .select("id", { count: "exact", head: true })
        .gte("created_at", start)
        .lte("created_at", end);

      if (filtroCapanha && filtroCapanha !== "all") {
        cliquesQuery = cliquesQuery.eq("campanha_id", filtroCapanha);
      }

      const { count: totalCliques } = await cliquesQuery;

      setStats({
        total: eventosData.length,
        unicos: telefonesUnicos.size,
        hoje: eventosHoje.length,
        hojeUnicos: hojeUnicos.size,
        enviados: enviados.length,
        enviadosUnicos: enviadosUnicos.size,
        cliques: totalCliques || 0,
      });
    }

    await fetchAtribuicao(start, end);
    await fetchCampanhaLeads(start, end);
    setLoading(false);
  };

  const fetchCampanhaLeads = async (start: string, end: string) => {
    try {
      // Busca todos eventos do periodo (sem filtro de campanha pra mostrar todas)
      const { data: evts } = await supabase
        .from("eventos")
        .select("campanha_id, telefone_masked, fbc, evento_enviado")
        .gte("created_at", start)
        .lte("created_at", end)
        .eq("evento_enviado", true);

      if (!evts || evts.length === 0) {
        setCampanhaLeads([]);
        return;
      }

      // Busca nomes das campanhas
      const { data: camps } = await supabase
        .from("campanhas")
        .select("id, nome");

      const campMap = new Map((camps || []).map((c) => [c.id, c.nome]));

      // Agrupa por campanha, deduplica por telefone
      const map = new Map<string, { nome: string; total: Set<string>; ads: Set<string> }>();

      for (const evt of evts) {
        if (!evt.campanha_id) continue;
        const nome = campMap.get(evt.campanha_id) || evt.campanha_id;
        if (!map.has(evt.campanha_id)) {
          map.set(evt.campanha_id, { nome, total: new Set(), ads: new Set() });
        }
        const row = map.get(evt.campanha_id)!;
        row.total.add(evt.telefone_masked);
        if (evt.fbc) row.ads.add(evt.telefone_masked);
      }

      const result: CampanhaLeads[] = Array.from(map.values())
        .map((row) => ({
          nome: row.nome,
          total_unicos: row.total.size,
          via_anuncio: row.ads.size,
          direto: row.total.size - row.ads.size,
          pct_anuncio: row.total.size > 0 ? Math.round((row.ads.size / row.total.size) * 100) : 0,
        }))
        .sort((a, b) => b.via_anuncio - a.via_anuncio);

      setCampanhaLeads(result);
    } catch (err) {
      console.error("Erro ao buscar leads por campanha:", err);
    }
  };

  const fetchAtribuicao = async (start: string, end: string) => {
    try {
      let cliquesQuery = supabase
        .from("cliques")
        .select("utm_campaign")
        .gte("created_at", start)
        .lte("created_at", end)
        .order("created_at", { ascending: false })
        .limit(500);

      if (filtroCapanha && filtroCapanha !== "all") {
        cliquesQuery = cliquesQuery.eq("campanha_id", filtroCapanha);
      }

      const { data: cliques } = await cliquesQuery;

      let eventosQuery = supabase
        .from("eventos")
        .select("utm_campaign, fbc, evento_enviado, telefone_masked")
        .gte("created_at", start)
        .lte("created_at", end)
        .limit(500);

      if (filtroCapanha && filtroCapanha !== "all") {
        eventosQuery = eventosQuery.eq("campanha_id", filtroCapanha);
      }

      const { data: eventosAttr } = await eventosQuery;

      if (!cliques && !eventosAttr) return;

      const map = new Map<string, AtribuicaoRow & { telefonesConversao: Set<string>; telefonesFbc: Set<string> }>();

      for (const click of cliques || []) {
        const key = click.utm_campaign || "(sem UTM)";
        if (!map.has(key)) {
          map.set(key, { utm_campaign: key, cliques: 0, conversoes: 0, com_fbc: 0, telefonesConversao: new Set(), telefonesFbc: new Set() });
        }
        map.get(key)!.cliques++;
      }

      for (const evt of eventosAttr || []) {
        const key = evt.utm_campaign || "(sem UTM)";
        if (!map.has(key)) {
          map.set(key, { utm_campaign: key, cliques: 0, conversoes: 0, com_fbc: 0, telefonesConversao: new Set(), telefonesFbc: new Set() });
        }
        const row = map.get(key)!;
        if (evt.evento_enviado && evt.telefone_masked) {
          row.telefonesConversao.add(evt.telefone_masked);
        }
        if (evt.fbc && evt.telefone_masked) {
          row.telefonesFbc.add(evt.telefone_masked);
        }
      }

      // Converte Sets pra contagem
      const result: AtribuicaoRow[] = Array.from(map.values()).map((row) => ({
        utm_campaign: row.utm_campaign,
        cliques: row.cliques,
        conversoes: row.telefonesConversao.size,
        com_fbc: row.telefonesFbc.size,
      })).sort((a, b) => b.cliques - a.cliques);

      setAtribuicao(result);
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

        {/* Filtro de Periodo */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Periodo:</span>
              </div>
              <Select value={periodo} onValueChange={(v) => { setPeriodo(v); }}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Selecione o periodo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hoje">Hoje</SelectItem>
                  <SelectItem value="ontem">Ontem</SelectItem>
                  <SelectItem value="7dias">Ultimos 7 dias</SelectItem>
                  <SelectItem value="30dias">Ultimos 30 dias</SelectItem>
                  <SelectItem value="tudo">Todo o periodo</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>

              {periodo === "custom" && (
                <>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">De:</label>
                    <Input
                      type="date"
                      value={dataInicio}
                      onChange={(e) => setDataInicio(e.target.value)}
                      className="w-[160px]"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Ate:</label>
                    <Input
                      type="date"
                      value={dataFim}
                      onChange={(e) => setDataFim(e.target.value)}
                      className="w-[160px]"
                    />
                  </div>
                </>
              )}

              <Select value={filtroCapanha} onValueChange={setFiltroCampanha}>
                <SelectTrigger className="w-[220px]">
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

              <Badge variant="outline" className="h-9 px-3 text-sm">
                {getPeriodoLabel()}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Leads Unicos</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.unicos}</div>
              <p className="text-xs text-muted-foreground">
                {stats.total !== stats.unicos && `${stats.total} registros totais`}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Leads Hoje</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.hojeUnicos}</div>
              <p className="text-xs text-muted-foreground">
                {stats.hoje !== stats.hojeUnicos && `${stats.hoje} registros totais`}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Enviados ao Pixel</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.enviadosUnicos}</div>
              <p className="text-xs text-muted-foreground">
                {stats.enviados !== stats.enviadosUnicos && `${stats.enviados} registros totais`}
              </p>
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

        {/* Resultados em Tempo Real por Campanha */}
        {campanhaRealtime.length > 0 && (
          <Card className="border-green-200 bg-green-50/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-green-600" />
                  <div>
                    <CardTitle>Entradas no Grupo - Tempo Real (Unicos)</CardTitle>
                    <CardDescription>
                      Atualiza automaticamente a cada 60 segundos - numeros deduplicados por telefone
                    </CardDescription>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchRealtime}
                  disabled={realtimeLoading}
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${realtimeLoading ? "animate-spin" : ""}`} />
                  Atualizar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campanha</TableHead>
                    <TableHead className="text-center">Hoje (Anuncio)</TableHead>
                    <TableHead className="text-center">Hoje (Direto)</TableHead>
                    <TableHead className="text-center">Hoje (Total)</TableHead>
                    <TableHead className="text-center">24h (Anuncio)</TableHead>
                    <TableHead className="text-center">24h (Total)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campanhaRealtime.map((row) => (
                    <TableRow key={row.nome}>
                      <TableCell className="font-medium">{row.nome}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="default" className="bg-green-600 text-base px-3">
                          {row.hoje_ads}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{row.hoje_direto}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-base px-3">{row.hoje_total}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="default" className="bg-blue-500">{row.ultimas24h_ads}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{row.ultimas24h_total}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="text-xs text-muted-foreground mt-3">
                <strong>Anuncio</strong> = entrou via anuncio (tem fbc/fbclid) | <strong>Direto</strong> = entrou direto no grupo (sem passar pelo anuncio)
              </p>
            </CardContent>
          </Card>
        )}

        {/* Leads por Campanha — via Anuncio vs Direto */}
        {campanhaLeads.length > 0 && (
          <Card className="border-blue-200">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                <div>
                  <CardTitle>Leads por Campanha — Via Anuncio ({getPeriodoLabel()})</CardTitle>
                  <CardDescription>
                    Quantas pessoas entraram pelo anuncio vs direto — deduplicado por telefone unico
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campanha</TableHead>
                    <TableHead className="text-center">Via Anuncio 🎯</TableHead>
                    <TableHead className="text-center">Direto</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead className="text-center">% Anuncio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campanhaLeads.map((row) => (
                    <TableRow key={row.nome}>
                      <TableCell className="font-medium">{row.nome}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="default" className="bg-green-600 text-base px-3">
                          {row.via_anuncio}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{row.direto}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-base px-3">{row.total_unicos}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`font-bold text-sm ${row.pct_anuncio >= 70 ? "text-green-600" : row.pct_anuncio >= 40 ? "text-yellow-600" : "text-red-500"}`}>
                          {row.pct_anuncio}%
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="text-xs text-muted-foreground mt-3">
                <strong>Via Anuncio</strong> = entrou com fbc/fbclid (veio do anuncio) |{" "}
                <strong>Direto</strong> = entrou sem atribuicao (link organico ou direto)
              </p>
            </CardContent>
          </Card>
        )}

        {/* Tabela de Atribuicao por UTM */}
        {atribuicao.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-500" />
                <div>
                  <CardTitle>Atribuicao por Campanha ({getPeriodoLabel()})</CardTitle>
                  <CardDescription>Conversoes e cliques deduplicados por telefone unico</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>utm_campaign</TableHead>
                    <TableHead className="text-center">Cliques</TableHead>
                    <TableHead className="text-center">Conversoes (unicos)</TableHead>
                    <TableHead className="text-center">Com fbc (unicos)</TableHead>
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
                <CardTitle>Eventos Recentes ({getPeriodoLabel()})</CardTitle>
                <CardDescription>Mostrando ate 200 eventos do periodo selecionado</CardDescription>
              </div>
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
                <p>Nenhum evento nesse periodo</p>
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

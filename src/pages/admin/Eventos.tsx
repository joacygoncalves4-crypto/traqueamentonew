import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Activity, Users, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Evento {
  id: string;
  telefone_masked: string;
  evento_enviado: boolean;
  created_at: string;
  campanha_id: string | null;
  gatilho_id: string | null;
  pixel_id: string | null;
  pixel_response: string | null;
  fonte: string | null;
  campanha?: { nome: string };
  gatilho?: { nome: string; keyword: string };
  pixel?: { nome: string };
}

interface Campanha {
  id: string;
  nome: string;
}

interface Pixel {
  id: string;
  nome: string;
}

interface Gatilho {
  id: string;
  nome: string;
  keyword: string;
}

const ITEMS_PER_PAGE = 20;

const Eventos = () => {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [gatilhos, setGatilhos] = useState<Gatilho[]>([]);
  const [pixels, setPixels] = useState<Pixel[]>([]);
  const [loading, setLoading] = useState(true);
  const [campanhaFilter, setCampanhaFilter] = useState<string>("all");
  const [pixelFilter, setPixelFilter] = useState<string>("all");
  const [fonteFilter, setFonteFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchFilters();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
    fetchEventos();
  }, [campanhaFilter, pixelFilter, fonteFilter]);

  useEffect(() => {
    fetchEventos();
  }, [currentPage]);

  const fetchFilters = async () => {
    const [campanhasRes, pixelsRes, gatilhosRes] = await Promise.all([
      supabase.from("campanhas").select("id, nome").order("nome"),
      supabase.from("pixels").select("id, nome").order("nome"),
      supabase.from("mensagem_gatilhos").select("id, nome, keyword").order("nome"),
    ]);

    if (campanhasRes.data) setCampanhas(campanhasRes.data);
    if (pixelsRes.data) setPixels(pixelsRes.data);
    if (gatilhosRes.data) setGatilhos(gatilhosRes.data);
  };

  const fetchEventos = async () => {
    setLoading(true);

    // Build count query
    let countQuery = supabase
      .from("eventos")
      .select("*", { count: "exact", head: true });

    if (campanhaFilter !== "all") {
      countQuery = countQuery.eq("campanha_id", campanhaFilter);
    }
    if (pixelFilter !== "all") {
      countQuery = countQuery.eq("pixel_id", pixelFilter);
    }
    if (fonteFilter !== "all") {
      countQuery = countQuery.eq("fonte", fonteFilter);
    }

    const { count } = await countQuery;
    setTotalCount(count || 0);

    // Build data query
    let dataQuery = supabase
      .from("eventos")
      .select("*")
      .order("created_at", { ascending: false })
      .range((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE - 1);

    if (campanhaFilter !== "all") {
      dataQuery = dataQuery.eq("campanha_id", campanhaFilter);
    }
    if (pixelFilter !== "all") {
      dataQuery = dataQuery.eq("pixel_id", pixelFilter);
    }
    if (fonteFilter !== "all") {
      dataQuery = dataQuery.eq("fonte", fonteFilter);
    }

    const { data, error } = await dataQuery;

    if (error) {
      console.error("Erro ao buscar eventos:", error);
      setEventos([]);
    } else {
      // Enrich with campaign, gatilho and pixel names
      const enrichedEventos = (data || []).map((evento: any) => {
        const campanha = campanhas.find((c) => c.id === evento.campanha_id);
        const gatilho = gatilhos.find((g) => g.id === evento.gatilho_id);
        const pixel = pixels.find((p) => p.id === evento.pixel_id);
        return {
          ...evento,
          campanha: campanha ? { nome: campanha.nome } : undefined,
          gatilho: gatilho ? { nome: gatilho.nome, keyword: gatilho.keyword } : undefined,
          pixel: pixel ? { nome: pixel.nome } : undefined,
        };
      });
      setEventos(enrichedEventos);
    }

    setLoading(false);
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd/MM/yyyy HH:mm", { locale: ptBR });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Activity className="h-6 w-6" />
              Eventos
            </h1>
            <p className="text-muted-foreground">
              Visualize todos os eventos de entrada em grupos e mensagens recebidas
            </p>
          </div>
          <Badge variant="outline" className="text-lg px-4 py-2">
            {totalCount} eventos
          </Badge>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="w-full sm:w-48">
                <label className="text-sm font-medium mb-2 block">Fonte</label>
                <Select value={fonteFilter} onValueChange={setFonteFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as fontes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as fontes</SelectItem>
                    <SelectItem value="whatsapp">Grupo WhatsApp</SelectItem>
                    <SelectItem value="mensagem">Mensagem Recebida</SelectItem>
                    <SelectItem value="telegram">Telegram</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full sm:w-64">
                <label className="text-sm font-medium mb-2 block">Campanha</label>
                <Select value={campanhaFilter} onValueChange={setCampanhaFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as campanhas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as campanhas</SelectItem>
                    {campanhas.map((campanha) => (
                      <SelectItem key={campanha.id} value={campanha.id}>
                        {campanha.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full sm:w-64">
                <label className="text-sm font-medium mb-2 block">Pixel</label>
                <Select value={pixelFilter} onValueChange={setPixelFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os pixels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os pixels</SelectItem>
                    {pixels.map((pixel) => (
                      <SelectItem key={pixel.id} value={pixel.id}>
                        {pixel.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Events Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">
                Carregando eventos...
              </div>
            ) : eventos.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                Nenhum evento encontrado
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fonte</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Pixel</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {eventos.map((evento) => (
                      <TableRow key={evento.id}>
                        <TableCell>
                          {evento.fonte === "mensagem" ? (
                            <Badge variant="secondary" className="gap-1">
                              <MessageSquare className="h-3 w-3" />
                              Mensagem
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1">
                              <Users className="h-3 w-3" />
                              Grupo
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-mono">
                          {evento.telefone_masked}
                        </TableCell>
                        <TableCell>
                          {evento.fonte === "mensagem" ? (
                            evento.gatilho ? (
                              <div>
                                <span className="font-medium">{evento.gatilho.nome}</span>
                                <span className="text-xs text-muted-foreground block">
                                  Keyword: {evento.gatilho.keyword}
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Gatilho removido</span>
                            )
                          ) : (
                            evento.campanha?.nome || (
                              <span className="text-muted-foreground">-</span>
                            )
                          )}
                        </TableCell>
                        <TableCell>
                          {evento.pixel?.nome || (
                            <span className="text-muted-foreground">Sem pixel</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={evento.evento_enviado ? "default" : "secondary"}
                          >
                            {evento.evento_enviado ? "Enviado" : "Pendente"}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(evento.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between p-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      Página {currentPage} de {totalPages}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                      >
                        Próxima
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default Eventos;
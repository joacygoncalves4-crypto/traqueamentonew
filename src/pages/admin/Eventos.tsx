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
import { ChevronLeft, ChevronRight, Activity } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Evento {
  id: string;
  telefone_masked: string;
  evento_enviado: boolean;
  created_at: string;
  campanha_id: string;
  pixel_id: string | null;
  pixel_response: string | null;
  campanha?: { nome: string };
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

const ITEMS_PER_PAGE = 20;

const Eventos = () => {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [pixels, setPixels] = useState<Pixel[]>([]);
  const [loading, setLoading] = useState(true);
  const [campanhaFilter, setCampanhaFilter] = useState<string>("all");
  const [pixelFilter, setPixelFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchFilters();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
    fetchEventos();
  }, [campanhaFilter, pixelFilter]);

  useEffect(() => {
    fetchEventos();
  }, [currentPage]);

  const fetchFilters = async () => {
    const [campanhasRes, pixelsRes] = await Promise.all([
      supabase.from("campanhas").select("id, nome").order("nome"),
      supabase.from("pixels").select("id, nome").order("nome"),
    ]);

    if (campanhasRes.data) setCampanhas(campanhasRes.data);
    if (pixelsRes.data) setPixels(pixelsRes.data);
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

    const { data, error } = await dataQuery;

    if (error) {
      console.error("Erro ao buscar eventos:", error);
      setEventos([]);
    } else {
      // Enrich with campaign and pixel names
      const enrichedEventos = await Promise.all(
        (data || []).map(async (evento) => {
          const campanha = campanhas.find((c) => c.id === evento.campanha_id);
          const pixel = pixels.find((p) => p.id === evento.pixel_id);
          return {
            ...evento,
            campanha: campanha ? { nome: campanha.nome } : undefined,
            pixel: pixel ? { nome: pixel.nome } : undefined,
          };
        })
      );
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
              Visualize todos os eventos de entrada em grupos
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
                      <TableHead>Telefone</TableHead>
                      <TableHead>Campanha</TableHead>
                      <TableHead>Pixel</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {eventos.map((evento) => (
                      <TableRow key={evento.id}>
                        <TableCell className="font-mono">
                          {evento.telefone_masked}
                        </TableCell>
                        <TableCell>
                          {evento.campanha?.nome || (
                            <span className="text-muted-foreground">-</span>
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

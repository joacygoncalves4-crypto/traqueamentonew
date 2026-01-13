import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Megaphone, Zap, ArrowRight } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Hero */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
            WhatsApp Tracker
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Rastreie entradas em grupos de WhatsApp e envie eventos de conversão
            para o Facebook Pixel automaticamente
          </p>
          <Link to="/admin/dashboard">
            <Button size="lg" className="gap-2">
              Acessar Painel <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <Card>
            <CardHeader>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-2">
                <Megaphone className="h-6 w-6 text-green-600" />
              </div>
              <CardTitle>Campanhas por Grupo</CardTitle>
              <CardDescription>
                Crie campanhas únicas para cada grupo de WhatsApp e rastreie a
                origem de cada lead
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-2">
                <Zap className="h-6 w-6 text-blue-600" />
              </div>
              <CardTitle>Integração Automática</CardTitle>
              <CardDescription>
                Webhook da Evolution API recebe eventos em tempo real e dispara
                para o Facebook Pixel
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-2">
                <BarChart3 className="h-6 w-6 text-purple-600" />
              </div>
              <CardTitle>Dashboard Completo</CardTitle>
              <CardDescription>
                Acompanhe todas as entradas, status do Pixel e métricas por
                campanha em tempo real
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* CTA */}
        <div className="text-center mt-16">
          <Card className="max-w-md mx-auto">
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-2">Comece agora</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Configure suas campanhas e comece a rastrear conversões
              </p>
              <div className="flex gap-2 justify-center">
                <Link to="/admin/campanhas">
                  <Button variant="outline">Criar Campanha</Button>
                </Link>
                <Link to="/admin/config">
                  <Button>Configurar Pixel</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Index;

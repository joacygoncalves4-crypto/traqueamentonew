import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import LandingPage from "./pages/LandingPage";
import Dashboard from "./pages/admin/Dashboard";
import Campanhas from "./pages/admin/Campanhas";
import Instancias from "./pages/admin/Instancias";
import Pixels from "./pages/admin/Pixels";
import Configuracoes from "./pages/admin/Configuracoes";
import Eventos from "./pages/admin/Eventos";
import Telegram from "./pages/admin/Telegram";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/entrar/:campanhaId" element={<LandingPage />} />
          <Route path="/admin/dashboard" element={<Dashboard />} />
          <Route path="/admin/campanhas" element={<Campanhas />} />
          <Route path="/admin/instancias" element={<Instancias />} />
          <Route path="/admin/pixels" element={<Pixels />} />
          <Route path="/admin/eventos" element={<Eventos />} />
          <Route path="/admin/telegram" element={<Telegram />} />
          <Route path="/admin/config" element={<Configuracoes />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

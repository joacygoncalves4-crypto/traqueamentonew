-- =============================================
-- SQL COMPLETO DO SISTEMA DE RASTREAMENTO
-- Cole TUDO isso no SQL Editor do Supabase e clique "Run"
-- Cria todas as tabelas do zero + campos de atribuição
-- =============================================

-- =============================================
-- FUNÇÃO update_updated_at (precisa existir antes dos triggers)
-- =============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- =============================================
-- TABELA: campanhas
-- =============================================
CREATE TABLE public.campanhas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    descricao TEXT,
    link_grupo TEXT NOT NULL,
    grupo_id TEXT NOT NULL UNIQUE,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    whatsapp_group_jid TEXT,
    tipo_destino TEXT DEFAULT 'grupo',
    numero_whatsapp TEXT
);

CREATE INDEX idx_campanhas_grupo_id ON public.campanhas(grupo_id);
CREATE INDEX idx_campanhas_tipo_destino ON public.campanhas(tipo_destino);

ALTER TABLE public.campanhas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Campanhas ativas são públicas" ON public.campanhas FOR SELECT USING (ativo = true);
CREATE POLICY "Campanhas podem ser inseridas" ON public.campanhas FOR INSERT WITH CHECK (true);
CREATE POLICY "Campanhas podem ser atualizadas" ON public.campanhas FOR UPDATE USING (true);
CREATE POLICY "Campanhas podem ser deletadas" ON public.campanhas FOR DELETE USING (true);

CREATE TRIGGER update_campanhas_updated_at
    BEFORE UPDATE ON public.campanhas
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- TABELA: configuracoes (singleton)
-- =============================================
CREATE TABLE public.configuracoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pixel_id TEXT,
    access_token TEXT,
    webhook_secret TEXT DEFAULT gen_random_uuid()::text,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

INSERT INTO public.configuracoes (id) VALUES (gen_random_uuid());

ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Config é legível publicamente" ON public.configuracoes FOR SELECT USING (true);
CREATE POLICY "Config pode ser atualizada" ON public.configuracoes FOR UPDATE USING (true);

CREATE TRIGGER update_configuracoes_updated_at
    BEFORE UPDATE ON public.configuracoes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- TABELA: evolution_instancias
-- =============================================
CREATE TABLE public.evolution_instancias (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  api_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  instance_name TEXT NOT NULL UNIQUE,
  numero_whatsapp TEXT,
  status TEXT DEFAULT 'disconnected',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TRIGGER update_evolution_instancias_updated_at
  BEFORE UPDATE ON public.evolution_instancias
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.evolution_instancias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Instancias são públicas para leitura" ON public.evolution_instancias FOR SELECT USING (true);
CREATE POLICY "Instancias podem ser inseridas" ON public.evolution_instancias FOR INSERT WITH CHECK (true);
CREATE POLICY "Instancias podem ser atualizadas" ON public.evolution_instancias FOR UPDATE USING (true);
CREATE POLICY "Instancias podem ser deletadas" ON public.evolution_instancias FOR DELETE USING (true);

-- =============================================
-- TABELA: evolution_grupos
-- =============================================
CREATE TABLE public.evolution_grupos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  instancia_id UUID REFERENCES public.evolution_instancias(id) ON DELETE CASCADE,
  group_jid TEXT NOT NULL,
  group_name TEXT NOT NULL,
  group_size INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(instancia_id, group_jid)
);

ALTER TABLE public.evolution_grupos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Grupos são públicos para leitura" ON public.evolution_grupos FOR SELECT USING (true);
CREATE POLICY "Grupos podem ser inseridos" ON public.evolution_grupos FOR INSERT WITH CHECK (true);
CREATE POLICY "Grupos podem ser atualizados" ON public.evolution_grupos FOR UPDATE USING (true);
CREATE POLICY "Grupos podem ser deletados" ON public.evolution_grupos FOR DELETE USING (true);

-- Adicionar FK de instancia na tabela campanhas
ALTER TABLE public.campanhas
  ADD COLUMN instancia_id UUID REFERENCES public.evolution_instancias(id) ON DELETE SET NULL;

-- =============================================
-- TABELA: pixels (Facebook Pixel)
-- =============================================
CREATE TABLE public.pixels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  pixel_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  test_event_code TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.pixels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pixels são públicos para leitura" ON public.pixels FOR SELECT USING (true);
CREATE POLICY "Pixels podem ser inseridos" ON public.pixels FOR INSERT WITH CHECK (true);
CREATE POLICY "Pixels podem ser atualizados" ON public.pixels FOR UPDATE USING (true);
CREATE POLICY "Pixels podem ser deletados" ON public.pixels FOR DELETE USING (true);

CREATE TRIGGER update_pixels_updated_at
  BEFORE UPDATE ON public.pixels
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Adicionar FK de pixel na tabela campanhas
ALTER TABLE public.campanhas ADD COLUMN pixel_id UUID REFERENCES public.pixels(id);

-- =============================================
-- TABELA: telegram_bots
-- =============================================
CREATE TABLE public.telegram_bots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  bot_token TEXT NOT NULL,
  bot_username TEXT,
  status TEXT DEFAULT 'disconnected',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.telegram_bots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Telegram bots são públicos para leitura" ON public.telegram_bots FOR SELECT USING (true);
CREATE POLICY "Telegram bots podem ser inseridos" ON public.telegram_bots FOR INSERT WITH CHECK (true);
CREATE POLICY "Telegram bots podem ser atualizados" ON public.telegram_bots FOR UPDATE USING (true);
CREATE POLICY "Telegram bots podem ser deletados" ON public.telegram_bots FOR DELETE USING (true);

-- Adicionar campos de Telegram na tabela campanhas
ALTER TABLE public.campanhas ADD COLUMN telegram_chat_id TEXT;
ALTER TABLE public.campanhas ADD COLUMN telegram_bot_id UUID REFERENCES public.telegram_bots(id);

-- =============================================
-- TABELA: mensagem_gatilhos
-- =============================================
CREATE TABLE public.mensagem_gatilhos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  instance_name TEXT NOT NULL,
  keyword TEXT NOT NULL,
  pixel_id UUID REFERENCES public.pixels(id),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.mensagem_gatilhos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gatilhos são públicos para leitura" ON public.mensagem_gatilhos FOR SELECT USING (true);
CREATE POLICY "Gatilhos podem ser inseridos" ON public.mensagem_gatilhos FOR INSERT WITH CHECK (true);
CREATE POLICY "Gatilhos podem ser atualizados" ON public.mensagem_gatilhos FOR UPDATE USING (true);
CREATE POLICY "Gatilhos podem ser deletados" ON public.mensagem_gatilhos FOR DELETE USING (true);

-- =============================================
-- TABELA: eventos (entradas no grupo / mensagens)
-- =============================================
CREATE TABLE public.eventos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id UUID REFERENCES public.campanhas(id) ON DELETE SET NULL,
    telefone_hash TEXT NOT NULL,
    telefone_masked TEXT NOT NULL,
    evento_enviado BOOLEAN DEFAULT false,
    pixel_response TEXT,
    pixel_id UUID,
    fonte TEXT DEFAULT 'whatsapp',
    gatilho_id UUID REFERENCES public.mensagem_gatilhos(id) ON DELETE SET NULL,
    -- Campos de atribuição Facebook
    fbclid TEXT,
    fbc TEXT,
    fbp TEXT,
    utm_campaign TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_eventos_campanha ON public.eventos(campanha_id);
CREATE INDEX idx_eventos_created_at ON public.eventos(created_at DESC);

ALTER TABLE public.eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Webhook pode inserir eventos" ON public.eventos FOR INSERT WITH CHECK (true);
CREATE POLICY "Eventos podem ser lidos" ON public.eventos FOR SELECT USING (true);

-- =============================================
-- TABELA: cliques (landing page tracking)
-- =============================================
CREATE TABLE public.cliques (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id UUID REFERENCES public.campanhas(id) ON DELETE CASCADE,
    fbclid TEXT,
    fbc TEXT,
    fbp TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    utm_content TEXT,
    utm_term TEXT,
    user_agent TEXT,
    landing_url TEXT,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_cliques_campanha_id ON public.cliques(campanha_id);
CREATE INDEX idx_cliques_created_at ON public.cliques(created_at DESC);
CREATE INDEX idx_cliques_fbclid ON public.cliques(fbclid);

ALTER TABLE public.cliques ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Landing page pode inserir cliques" ON public.cliques FOR INSERT WITH CHECK (true);
CREATE POLICY "Webhook pode ler cliques" ON public.cliques FOR SELECT USING (true);
CREATE POLICY "Admin pode deletar cliques" ON public.cliques FOR DELETE USING (true);

-- =============================================
-- PRONTO! Todas as tabelas criadas com sucesso.
-- =============================================

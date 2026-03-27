-- Migration: Adiciona campos de atribuição para rastreamento completo do Facebook Ads
-- Esses campos permitem enviar fbc, fbp e UTMs para a Meta Conversions API
-- aumentando o Event Match Quality Score e melhorando a otimização de campanhas

-- =============================================
-- 1. Tabela de cliques (landing page tracking)
-- Armazena os dados de atribuição capturados na landing page
-- para depois vincular ao evento de entrada no grupo
-- =============================================
CREATE TABLE IF NOT EXISTS public.cliques (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id UUID REFERENCES public.campanhas(id) ON DELETE CASCADE,
    -- Dados do Facebook
    fbclid TEXT,
    fbc TEXT,
    fbp TEXT,
    -- UTMs do anúncio
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    utm_content TEXT,
    utm_term TEXT,
    -- Dados do browser
    user_agent TEXT,
    landing_url TEXT,
    ip_address TEXT,
    -- Timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para busca rápida
CREATE INDEX IF NOT EXISTS idx_cliques_campanha_id ON public.cliques(campanha_id);
CREATE INDEX IF NOT EXISTS idx_cliques_created_at ON public.cliques(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cliques_fbclid ON public.cliques(fbclid);

-- RLS: permitir insert público (landing page) e select público (webhook precisa ler)
ALTER TABLE public.cliques ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Landing page pode inserir cliques"
ON public.cliques FOR INSERT WITH CHECK (true);

CREATE POLICY "Webhook pode ler cliques"
ON public.cliques FOR SELECT USING (true);

CREATE POLICY "Admin pode deletar cliques"
ON public.cliques FOR DELETE USING (true);

-- =============================================
-- 2. Adicionar campos de atribuição na tabela eventos
-- Para saber quais eventos foram enviados com fbc/fbp
-- =============================================
ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS fbclid TEXT;
ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS fbc TEXT;
ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS fbp TEXT;
ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS utm_campaign TEXT;
ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- =============================================
-- 3. Adicionar campo tipo_destino na tabela campanhas
-- Para diferenciar campanhas de grupo vs número WhatsApp
-- =============================================
ALTER TABLE public.campanhas ADD COLUMN IF NOT EXISTS tipo_destino TEXT DEFAULT 'grupo' CHECK (tipo_destino IN ('grupo', 'numero', 'telegram'));
ALTER TABLE public.campanhas ADD COLUMN IF NOT EXISTS numero_whatsapp TEXT;

-- Índice para busca por tipo
CREATE INDEX IF NOT EXISTS idx_campanhas_tipo_destino ON public.campanhas(tipo_destino);

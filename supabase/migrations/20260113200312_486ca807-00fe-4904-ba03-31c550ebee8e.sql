-- Tabela de campanhas
CREATE TABLE public.campanhas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    descricao TEXT,
    link_grupo TEXT NOT NULL,
    grupo_id TEXT NOT NULL UNIQUE,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de eventos (entradas no grupo)
CREATE TABLE public.eventos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id UUID REFERENCES public.campanhas(id) ON DELETE CASCADE NOT NULL,
    telefone_hash TEXT NOT NULL,
    telefone_masked TEXT NOT NULL,
    evento_enviado BOOLEAN DEFAULT false,
    pixel_response TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de configurações (singleton)
CREATE TABLE public.configuracoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pixel_id TEXT,
    access_token TEXT,
    webhook_secret TEXT DEFAULT gen_random_uuid()::text,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Inserir configuração padrão
INSERT INTO public.configuracoes (id) VALUES (gen_random_uuid());

-- Índices para performance
CREATE INDEX idx_eventos_campanha ON public.eventos(campanha_id);
CREATE INDEX idx_eventos_created_at ON public.eventos(created_at DESC);
CREATE INDEX idx_campanhas_grupo_id ON public.campanhas(grupo_id);

-- Enable RLS
ALTER TABLE public.campanhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

-- Políticas públicas de leitura para landing page (apenas campanhas ativas)
CREATE POLICY "Campanhas ativas são públicas" 
ON public.campanhas 
FOR SELECT 
USING (ativo = true);

-- Políticas para webhook (insert de eventos sem auth)
CREATE POLICY "Webhook pode inserir eventos" 
ON public.eventos 
FOR INSERT 
WITH CHECK (true);

-- Políticas para leitura de config (webhook precisa ler)
CREATE POLICY "Config é legível publicamente" 
ON public.configuracoes 
FOR SELECT 
USING (true);

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER update_campanhas_updated_at
    BEFORE UPDATE ON public.campanhas
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_configuracoes_updated_at
    BEFORE UPDATE ON public.configuracoes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
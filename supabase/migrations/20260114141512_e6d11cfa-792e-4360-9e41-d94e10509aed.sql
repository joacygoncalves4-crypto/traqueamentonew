-- Adicionar políticas RLS para campanhas
CREATE POLICY "Campanhas podem ser inseridas" 
ON public.campanhas 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Campanhas podem ser atualizadas" 
ON public.campanhas 
FOR UPDATE 
USING (true);

CREATE POLICY "Campanhas podem ser deletadas" 
ON public.campanhas 
FOR DELETE 
USING (true);

-- Adicionar política RLS para configuracoes
CREATE POLICY "Config pode ser atualizada" 
ON public.configuracoes 
FOR UPDATE 
USING (true);

-- Criar tabela de pixels
CREATE TABLE public.pixels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  pixel_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS na tabela pixels
ALTER TABLE public.pixels ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para pixels
CREATE POLICY "Pixels são públicos para leitura" 
ON public.pixels 
FOR SELECT 
USING (true);

CREATE POLICY "Pixels podem ser inseridos" 
ON public.pixels 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Pixels podem ser atualizados" 
ON public.pixels 
FOR UPDATE 
USING (true);

CREATE POLICY "Pixels podem ser deletados" 
ON public.pixels 
FOR DELETE 
USING (true);

-- Adicionar coluna pixel_id na tabela campanhas
ALTER TABLE public.campanhas 
ADD COLUMN pixel_id UUID REFERENCES public.pixels(id);

-- Adicionar coluna pixel_id na tabela eventos para rastreamento
ALTER TABLE public.eventos 
ADD COLUMN pixel_id UUID;

-- Trigger para updated_at na tabela pixels
CREATE TRIGGER update_pixels_updated_at
BEFORE UPDATE ON public.pixels
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
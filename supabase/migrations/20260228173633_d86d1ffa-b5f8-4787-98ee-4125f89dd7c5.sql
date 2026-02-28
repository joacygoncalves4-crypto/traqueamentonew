
-- Tabela de gatilhos de mensagem recebida
CREATE TABLE public.mensagem_gatilhos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  instance_name TEXT NOT NULL,
  keyword TEXT NOT NULL,
  pixel_id UUID REFERENCES public.pixels(id),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.mensagem_gatilhos ENABLE ROW LEVEL SECURITY;

-- Policies (mesmo padrão permissivo das outras tabelas)
CREATE POLICY "Gatilhos são públicos para leitura"
ON public.mensagem_gatilhos FOR SELECT
USING (true);

CREATE POLICY "Gatilhos podem ser inseridos"
ON public.mensagem_gatilhos FOR INSERT
WITH CHECK (true);

CREATE POLICY "Gatilhos podem ser atualizados"
ON public.mensagem_gatilhos FOR UPDATE
USING (true);

CREATE POLICY "Gatilhos podem ser deletados"
ON public.mensagem_gatilhos FOR DELETE
USING (true);

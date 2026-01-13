-- Tabela para armazenar as instâncias da Evolution API
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

-- Tabela para armazenar os grupos sincronizados
CREATE TABLE public.evolution_grupos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  instancia_id UUID REFERENCES public.evolution_instancias(id) ON DELETE CASCADE,
  group_jid TEXT NOT NULL,
  group_name TEXT NOT NULL,
  group_size INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(instancia_id, group_jid)
);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_evolution_instancias_updated_at
  BEFORE UPDATE ON public.evolution_instancias
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.evolution_instancias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evolution_grupos ENABLE ROW LEVEL SECURITY;

-- Policies para evolution_instancias (acesso público para admin - sem auth por enquanto)
CREATE POLICY "Instancias são públicas para leitura"
  ON public.evolution_instancias FOR SELECT
  USING (true);

CREATE POLICY "Instancias podem ser inseridas"
  ON public.evolution_instancias FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Instancias podem ser atualizadas"
  ON public.evolution_instancias FOR UPDATE
  USING (true);

CREATE POLICY "Instancias podem ser deletadas"
  ON public.evolution_instancias FOR DELETE
  USING (true);

-- Policies para evolution_grupos
CREATE POLICY "Grupos são públicos para leitura"
  ON public.evolution_grupos FOR SELECT
  USING (true);

CREATE POLICY "Grupos podem ser inseridos"
  ON public.evolution_grupos FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Grupos podem ser atualizados"
  ON public.evolution_grupos FOR UPDATE
  USING (true);

CREATE POLICY "Grupos podem ser deletados"
  ON public.evolution_grupos FOR DELETE
  USING (true);

-- Adicionar coluna instancia_id na tabela campanhas
ALTER TABLE public.campanhas
  ADD COLUMN instancia_id UUID REFERENCES public.evolution_instancias(id) ON DELETE SET NULL;
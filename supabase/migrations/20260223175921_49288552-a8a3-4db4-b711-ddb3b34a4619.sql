
-- 1. Criar tabela telegram_bots
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

-- 2. Adicionar campos na tabela campanhas
ALTER TABLE public.campanhas ADD COLUMN telegram_chat_id TEXT;
ALTER TABLE public.campanhas ADD COLUMN telegram_bot_id UUID REFERENCES public.telegram_bots(id);

-- 3. Adicionar campo fonte na tabela eventos
ALTER TABLE public.eventos ADD COLUMN fonte TEXT DEFAULT 'whatsapp';

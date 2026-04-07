-- ============================================================
-- Migration: Adiciona campos de tracking FIFO na tabela cliques
-- ============================================================
-- Rode no SQL Editor do Supabase

-- Novos campos para FIFO matching
ALTER TABLE public.cliques
  ADD COLUMN IF NOT EXISTS click_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'matched', 'expired')),
  ADD COLUMN IF NOT EXISTS matched_evento_id UUID REFERENCES public.eventos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS matched_at TIMESTAMPTZ;

-- Index para acelerar busca FIFO de cliques pendentes por campanha
CREATE INDEX IF NOT EXISTS idx_cliques_pending_campanha
  ON public.cliques (campanha_id, status, created_at)
  WHERE status = 'pending';

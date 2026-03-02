-- Make campanha_id nullable so message trigger events can be saved without a campaign
ALTER TABLE public.eventos ALTER COLUMN campanha_id DROP NOT NULL;

-- Drop existing FK constraint
ALTER TABLE public.eventos DROP CONSTRAINT IF EXISTS eventos_campanha_id_fkey;

-- Re-add FK constraint but allow NULLs (ON DELETE SET NULL)
ALTER TABLE public.eventos ADD CONSTRAINT eventos_campanha_id_fkey 
  FOREIGN KEY (campanha_id) REFERENCES public.campanhas(id) ON DELETE SET NULL;

-- Add a gatilho_id column to link message events to their trigger
ALTER TABLE public.eventos ADD COLUMN gatilho_id uuid REFERENCES public.mensagem_gatilhos(id) ON DELETE SET NULL;
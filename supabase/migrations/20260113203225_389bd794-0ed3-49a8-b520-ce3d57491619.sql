-- Adicionar campo para armazenar o JID real do grupo WhatsApp
ALTER TABLE public.campanhas 
ADD COLUMN whatsapp_group_jid TEXT;
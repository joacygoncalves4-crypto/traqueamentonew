-- Adicionar política de SELECT para eventos (necessária para visualização)
CREATE POLICY "Eventos podem ser lidos"
ON public.eventos
FOR SELECT
USING (true);
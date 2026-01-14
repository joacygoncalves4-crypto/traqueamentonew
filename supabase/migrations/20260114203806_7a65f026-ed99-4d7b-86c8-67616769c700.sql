-- Adiciona campo para código de eventos teste do Facebook
ALTER TABLE pixels 
ADD COLUMN test_event_code text DEFAULT NULL;

COMMENT ON COLUMN pixels.test_event_code IS 'Código de eventos teste do Facebook. Deixe vazio para produção.';
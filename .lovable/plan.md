

# Plano: Integração Telegram para Rastreamento de Entrada em Canais/Grupos

## Resumo

Criar um sistema completo para rastrear entradas em canais/grupos do Telegram, usando um Bot Token. Quando alguém entrar no canal, o sistema identifica a campanha e dispara o evento para o Facebook Pixel -- igual ao WhatsApp.

---

## Como vai funcionar

1. Voce cadastra um **Bot do Telegram** no painel (com o token do BotFather)
2. O sistema configura automaticamente um **webhook** no Telegram
3. Quando alguem entra no canal/grupo, o Telegram avisa o bot
4. O sistema identifica a campanha pelo **chat_id** do canal
5. Dispara o evento **GrupoEntrada** para o Facebook Pixel

---

## Mudancas Necessarias

### 1. Nova tabela: `telegram_bots`

Armazena os bots do Telegram cadastrados.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | PK |
| nome | text | Nome do bot |
| bot_token | text | Token do BotFather |
| bot_username | text | Username do bot (ex: @meubot) |
| status | text | connected / disconnected |
| created_at | timestamp | Data de criacao |

### 2. Adicionar campo na tabela `campanhas`

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| telegram_chat_id | text | Chat ID do canal/grupo Telegram |
| telegram_bot_id | uuid | FK para telegram_bots |

### 3. Adicionar campo na tabela `eventos`

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| fonte | text | 'whatsapp' ou 'telegram' (default 'whatsapp') |

---

### 4. Nova Edge Function: `webhook-telegram`

Recebe updates do Telegram Bot API:
- Filtra evento `chat_member` com status `member` (entrada)
- Busca campanha pelo `telegram_chat_id`
- Extrai user_id do Telegram (hash SHA256)
- Envia evento para Facebook CAPI
- Salva no banco com fonte = 'telegram'

### 5. Nova Edge Function: `telegram-api`

Gerencia os bots:
- **register**: Salva bot e configura webhook no Telegram
- **status**: Verifica se bot esta funcionando
- **delete**: Remove webhook e deleta bot

### 6. Nova pagina: `/admin/telegram`

Interface para gerenciar bots do Telegram:
- Cadastrar novo bot (colar o token)
- Ver status do bot
- Excluir bot

### 7. Atualizar pagina de Campanhas

- Adicionar opcao de vincular canal Telegram (alem do WhatsApp)
- Selecionar bot + digitar chat_id do canal
- Suportar campanhas hibridas (WhatsApp + Telegram)

---

## Fluxo Tecnico

```text
Telegram Bot API
       |
       | (webhook POST)
       v
webhook-telegram (Edge Function)
       |
       | 1. Recebe update "chat_member"
       | 2. Filtra: new_status == "member"
       | 3. Busca campanha por telegram_chat_id
       | 4. Hash SHA256 do user_id
       | 5. Envia para Facebook CAPI
       | 6. Salva evento no banco
       v
  Facebook Pixel + DB
```

---

## Detalhes Tecnicos

### Edge Function `webhook-telegram`
- Endpoint: recebe POST do Telegram
- Evento monitorado: `chat_member` (quando `new_chat_member.status === "member"`)
- User data para Facebook: hash do user_id do Telegram (ja que nao tem telefone)
- Event name: `GrupoEntrada` (mesmo do WhatsApp)
- Custom data inclui: `source: "telegram"`, `campaign_name`, `chat_id`

### Edge Function `telegram-api`
- Action `register`:
  1. Valida token chamando `getMe` na API do Telegram
  2. Configura webhook: `setWebhook` apontando para `webhook-telegram`
  3. Salva bot no banco
- Action `status`: Chama `getWebhookInfo` para verificar
- Action `delete`: Chama `deleteWebhook` e remove do banco

### Webhook URL do Telegram
```text
https://aufgcioktpwomlscmkjr.supabase.co/functions/v1/webhook-telegram?bot_id=<uuid>
```
O `bot_id` na query string identifica qual bot enviou o update.

### Configuracao no `config.toml`
```text
[functions.webhook-telegram]
verify_jwt = false
```

---

## Arquivos a criar/modificar

| Arquivo | Acao |
|---------|------|
| `supabase/functions/webhook-telegram/index.ts` | Criar |
| `supabase/functions/telegram-api/index.ts` | Criar |
| `src/pages/admin/Telegram.tsx` | Criar |
| `src/pages/admin/Campanhas.tsx` | Modificar (adicionar opcao Telegram) |
| `src/App.tsx` | Modificar (adicionar rota /admin/telegram) |
| `src/components/admin/AdminLayout.tsx` | Modificar (adicionar link Telegram no menu) |
| Migration SQL | Criar tabela + alterar campanhas/eventos |

---

## Resultado Esperado

1. Usuario cadastra bot com token do BotFather
2. Sistema configura webhook automaticamente
3. Adiciona bot do Telegram como admin do canal
4. Cria campanha vinculando o canal ao Pixel
5. Quando alguem entra no canal, evento dispara automaticamente para o Facebook


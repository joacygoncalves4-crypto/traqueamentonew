# 📊 WhatsApp & Telegram Lead Tracker - Documentação Completa

> **ATENÇÃO IA**: Este arquivo contém toda a documentação do projeto. Leia este arquivo INTEIRO antes de fazer qualquer alteração no código. Não quebre a lógica existente. Ao final deste documento há instruções de como adicionar novas entradas ao histórico.

---

## 🎯 Objetivo do Projeto

Sistema de **rastreamento de leads** para WhatsApp e Telegram, focado em **atribuir entradas em grupos/canais e mensagens recebidas a campanhas de anúncios do Facebook** através da **Conversions API (CAPI)**.

**Em resumo**: Quando alguém entra em um grupo de WhatsApp/Telegram OU envia uma mensagem com uma keyword específica, o sistema dispara um evento para o Facebook Pixel via server-side (CAPI), permitindo que o Facebook otimize as campanhas de tráfego.

---

## 🏗️ Como Foi Construído

Este projeto foi construído usando o **Lovable** (https://lovable.dev), uma plataforma de desenvolvimento assistida por IA. O frontend é desenvolvido e visualizado no Lovable, enquanto o backend roda no **Lovable Cloud** (que usa Supabase por baixo dos panos).

### Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| UI | Tailwind CSS + shadcn/ui |
| Estado | TanStack React Query |
| Roteamento | React Router DOM v6 |
| Backend | Lovable Cloud (Supabase) |
| Edge Functions | Deno (Supabase Edge Functions) |
| Integrações | Evolution API (WhatsApp), Telegram Bot API, Facebook Conversions API |

### Estrutura de Pastas Importante

```
src/
├── App.tsx                          # Rotas da aplicação
├── components/
│   ├── admin/AdminLayout.tsx        # Layout do painel admin (header + nav)
│   └── ui/                          # Componentes shadcn/ui
├── pages/
│   ├── Index.tsx                    # Página inicial (redireciona)
│   ├── LandingPage.tsx              # Landing page pública /entrar/:campanhaId
│   └── admin/
│       ├── Dashboard.tsx            # Dashboard geral
│       ├── Campanhas.tsx            # CRUD de campanhas
│       ├── Instancias.tsx           # Gestão de instâncias WhatsApp (Evolution)
│       ├── Pixels.tsx               # CRUD de pixels do Facebook
│       ├── Eventos.tsx              # Visualização de eventos disparados
│       ├── Telegram.tsx             # Gestão de bots Telegram
│       ├── MensagemRecebida.tsx     # Gatilhos por keyword (mensagem recebida)
│       └── Configuracoes.tsx        # Configurações gerais
├── integrations/supabase/
│   ├── client.ts                    # Cliente Supabase (NÃO EDITAR)
│   └── types.ts                     # Tipos gerados (NÃO EDITAR)
└── lib/
    └── utils.ts                     # Utilitários (cn, etc.)

supabase/functions/
├── evolution-api/index.ts           # Proxy para Evolution API (criar/conectar/webhook instâncias)
├── webhook-evolution/index.ts       # Webhook que recebe eventos do WhatsApp
├── telegram-api/index.ts            # Gestão de bots Telegram (registrar/status/deletar)
└── webhook-telegram/index.ts        # Webhook que recebe eventos do Telegram
```

---

## 🗄️ Banco de Dados (Tabelas)

### `pixels`
Armazena pixels do Facebook configurados.
- `id` (uuid PK), `nome`, `pixel_id` (ID do FB), `access_token` (token CAPI), `ativo`, `test_event_code` (para modo teste)

### `campanhas`
Campanhas vinculadas a grupos WhatsApp/Telegram.
- `id`, `nome`, `descricao`, `link_grupo` (link WhatsApp), `grupo_id` (slug para URL), `whatsapp_group_jid` (JID do grupo), `instancia_id` (FK evolution_instancias), `pixel_id` (FK pixels), `telegram_bot_id`, `telegram_chat_id`, `ativo`

### `evolution_instancias`
Instâncias da Evolution API (cada número WhatsApp conectado).
- `id`, `nome`, `api_url`, `api_key`, `instance_name`, `numero_whatsapp`, `status` (connected/disconnected)

### `evolution_grupos`
Grupos de WhatsApp sincronizados de cada instância.
- `id`, `instancia_id` (FK), `group_jid`, `group_name`, `group_size`

### `mensagem_gatilhos`
Gatilhos por keyword para o recurso "Mensagem Recebida".
- `id`, `nome`, `instance_name`, `keyword`, `pixel_id` (FK pixels), `ativo`

### `telegram_bots`
Bots do Telegram cadastrados.
- `id`, `nome`, `bot_token`, `bot_username`, `status`

### `eventos`
Registro de todos os eventos disparados (entrada em grupo ou mensagem recebida).
- `id`, `campanha_id` (FK campanhas, nullable), `gatilho_id` (FK mensagem_gatilhos, nullable), `telefone_hash`, `telefone_masked`, `evento_enviado` (bool), `pixel_response`, `pixel_id`, `fonte` (null=grupo_whatsapp, "telegram", "mensagem"), `created_at`

### `configuracoes`
Configurações globais (legado).

---

## 🔄 Fluxos de Funcionamento

### Fluxo 1: Entrada em Grupo WhatsApp → Facebook Pixel

```
1. Usuário clica no link do grupo WhatsApp (via landing page /entrar/:campanhaId)
2. Usuário entra no grupo
3. Evolution API detecta evento GROUP_PARTICIPANTS_UPDATE (action: "add")
4. Evolution API envia webhook para: /functions/v1/webhook-evolution
5. webhook-evolution:
   a. Extrai JID do grupo e telefones dos participantes
   b. Busca campanha ativa com aquele whatsapp_group_jid
   c. Busca pixel associado à campanha
   d. Para cada participante:
      - Hash SHA-256 do telefone (privacidade)
      - Envia evento "GrupoEntrada" para Facebook CAPI
      - Salva na tabela eventos
```

### Fluxo 2: Mensagem Recebida com Keyword → Facebook Pixel

```
1. Alguém envia mensagem para o WhatsApp da instância
2. Evolution API detecta evento MESSAGES_UPSERT
3. Evolution API envia webhook para: /functions/v1/webhook-evolution
4. webhook-evolution:
   a. Verifica que NÃO é mensagem enviada por nós (fromMe: false)
   b. Extrai texto da mensagem e telefone do remetente
   c. Busca gatilhos ativos na tabela mensagem_gatilhos
   d. Filtra: instance_name deve bater E keyword deve estar contida na mensagem (case-insensitive)
   e. Para cada gatilho que matchou:
      - Hash SHA-256 do telefone
      - Envia evento "MensagemRecebida" para Facebook CAPI
      - Salva na tabela eventos com fonte='mensagem' e gatilho_id
```

### Fluxo 3: Entrada em Grupo/Canal Telegram → Facebook Pixel

```
1. Usuário entra em grupo/canal do Telegram onde o bot está presente
2. Telegram envia webhook chat_member update para: /functions/v1/webhook-telegram?bot_id=X
3. webhook-telegram:
   a. Verifica que é new_chat_member com status "member"
   b. Extrai chat_id e user_id do Telegram
   c. Busca campanha ativa com aquele telegram_chat_id
   d. Busca pixel associado à campanha
   e. Hash SHA-256 do user_id (como external_id)
   f. Envia evento "GrupoEntrada" para Facebook CAPI (source: "telegram")
   g. Salva na tabela eventos com fonte='telegram'
```

---

## 🔌 Edge Functions (Backend)

### `evolution-api` (Proxy)
Proxy para a Evolution API. Ações disponíveis:
- `create` - Criar instância WhatsApp
- `connect` - Gerar QR Code para conectar
- `status` - Verificar status de conexão + número
- `groups` - Listar grupos da instância
- `webhook` - Configurar webhook (eventos: GROUP_PARTICIPANTS_UPDATE, MESSAGES_UPSERT)
- `disconnect` - Desconectar instância
- `delete` - Deletar instância
- `fetchInstances` - Listar todas instâncias na Evolution
- `findWebhook` - Ver webhook configurado

**Secrets necessários**: `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`

### `webhook-evolution` (Webhook Receiver)
Recebe webhooks da Evolution API. Processa dois tipos de eventos:
- `MESSAGES_UPSERT` / `messages.upsert` → Mensagem recebida → Match keyword → Facebook CAPI
- `GROUP_PARTICIPANTS_UPDATE` / `group-participants.update` → Entrada em grupo → Facebook CAPI

**Importante**: `verify_jwt = false` (recebe chamadas externas)

### `telegram-api` (Proxy)
Gestão de bots Telegram. Ações:
- `register` - Registrar bot (valida token, salva no banco, configura webhook)
- `status` - Verificar status do webhook
- `delete` - Remover bot e limpar webhook

### `webhook-telegram` (Webhook Receiver)
Recebe webhooks do Telegram (chat_member updates). Processa entradas em grupos/canais.

**Importante**: `verify_jwt = false`

---

## 📡 Facebook Conversions API (CAPI)

### Formato do Evento

```json
{
  "data": [{
    "event_name": "GrupoEntrada" | "MensagemRecebida",
    "event_time": 1234567890,
    "event_id": "grp_PHONE_TIMESTAMP" | "msg_PHONE_TIMESTAMP",
    "action_source": "website",
    "user_data": {
      "ph": ["SHA256_DO_TELEFONE"],       // WhatsApp
      "external_id": ["SHA256_USER_ID"],   // Telegram
      "country": ["SHA256_de_br"]
    },
    "custom_data": {
      "campaign_id": "...",
      "campaign_name": "...",
      // ou para mensagem:
      "source": "mensagem",
      "trigger_name": "...",
      "keyword": "..."
    }
  }],
  "test_event_code": "TEST12345"  // Opcional, para modo teste
}
```

### Endpoint
```
POST https://graph.facebook.com/v18.0/{PIXEL_ID}/events?access_token={TOKEN}
```

### Eventos Personalizados
- **GrupoEntrada**: Disparado quando alguém entra em um grupo (WhatsApp ou Telegram)
- **MensagemRecebida**: Disparado quando alguém envia mensagem com keyword específica

### Dica para Campanhas de Tráfego
- Use campanhas de **Conversão** (não tráfego) para melhor otimização
- O Facebook precisa de ~50 eventos por semana para otimizar bem
- Use o `test_event_code` para validar antes de ir para produção
- O token de acesso deve ser gerado via **Dataset Quality API** no Gerenciador de Eventos

---

## 🖥️ Páginas do Admin

| Rota | Página | Função |
|------|--------|--------|
| `/admin/dashboard` | Dashboard | Visão geral de métricas |
| `/admin/campanhas` | Campanhas | CRUD de campanhas (WhatsApp + Telegram) |
| `/admin/instancias` | Instâncias | Conectar/gerenciar números WhatsApp via Evolution API |
| `/admin/pixels` | Pixels | CRUD de pixels Facebook (ID + Token + modo teste) |
| `/admin/telegram` | Telegram | Registrar/gerenciar bots Telegram |
| `/admin/mensagem-recebida` | Msg Recebida | CRUD de gatilhos por keyword |
| `/admin/eventos` | Eventos | Visualizar eventos disparados |
| `/admin/config` | Configurações | Configurações gerais |

### Landing Page Pública
- Rota: `/entrar/:campanhaId`
- Função: Página de redirecionamento para o link do grupo WhatsApp

---

## ⚠️ Regras Críticas (NÃO QUEBRE ISSO)

1. **NUNCA edite** `src/integrations/supabase/client.ts` ou `src/integrations/supabase/types.ts` - são auto-gerados
2. **NUNCA edite** o arquivo `.env` - é auto-gerenciado
3. Os webhooks (`webhook-evolution` e `webhook-telegram`) devem ter `verify_jwt = false`
4. O hash SHA-256 é usado para privacidade dos dados do usuário (compliance LGPD/GDPR)
5. O campo `fromMe` deve ser verificado para ignorar mensagens enviadas pela própria instância
6. Keywords são case-insensitive e usam `includes` (contém), não match exato
7. O campo `fonte` na tabela eventos diferencia: null/vazio = grupo WhatsApp, "telegram" = Telegram, "mensagem" = keyword trigger
8. RLS está configurado como permissivo (sem autenticação implementada ainda)
9. A Evolution API requer as env vars `EVOLUTION_API_URL` e `EVOLUTION_API_KEY` configuradas como secrets

---

## 📝 Histórico de Alterações

### v1.0 - Setup Inicial
- Criação do projeto no Lovable
- Estrutura básica React + Tailwind + shadcn/ui
- Painel admin com layout e navegação

### v2.0 - Integração WhatsApp (Evolution API)
- Integração com Evolution API para conectar números WhatsApp
- Página de Instâncias com QR Code, status, sincronização de grupos
- Edge function `evolution-api` como proxy
- Edge function `webhook-evolution` para receber eventos de grupo

### v3.0 - Sistema de Campanhas e Pixels
- CRUD de Campanhas vinculadas a grupos WhatsApp
- CRUD de Pixels do Facebook (ID + Token CAPI)
- Envio de evento "GrupoEntrada" para Facebook CAPI quando alguém entra no grupo
- Landing page `/entrar/:campanhaId` para redirecionamento
- Tabela de Eventos para registro de tudo que é disparado

### v4.0 - Integração Telegram
- Registro de bots Telegram via BotFather token
- Webhook para detectar entrada em grupos/canais Telegram
- Envio de evento "GrupoEntrada" (source: telegram) para Facebook CAPI
- Suporte a `external_id` (user_id do Telegram hashado) como identificador

### v5.0 - Mensagem Recebida (Keyword Trigger)
- Nova tabela `mensagem_gatilhos` para configurar keywords
- Expansão do `webhook-evolution` para processar `MESSAGES_UPSERT`
- Envio de evento "MensagemRecebida" para Facebook CAPI
- Página `/admin/mensagem-recebida` para gestão de gatilhos
- Campo `fonte` e `gatilho_id` na tabela eventos

### v5.1 - Melhorias
- Adição de `test_event_code` nos pixels para modo teste Facebook
- Edição de campanhas e gatilhos (além de criação)
- Verificação de status de conexão das instâncias
- Formatação de números de telefone

---

## 🤖 Comando para Atualizar Este Documento

Sempre que fizer uma alteração significativa no projeto, envie este prompt para a IA:

```
Atualize o arquivo PROJETO_DOCUMENTACAO.md adicionando uma nova entrada no "Histórico de Alterações" com a versão incrementada, descrevendo o que foi feito. Também atualize qualquer seção relevante (tabelas, fluxos, edge functions, etc.) se a estrutura mudou.

O que foi feito: [DESCREVA AQUI O QUE MUDOU]
```

**Exemplo:**
```
Atualize o arquivo PROJETO_DOCUMENTACAO.md adicionando uma nova entrada no "Histórico de Alterações" com a versão incrementada, descrevendo o que foi feito. Também atualize qualquer seção relevante (tabelas, fluxos, edge functions, etc.) se a estrutura mudou.

O que foi feito: Adicionei autenticação com login e senha para proteger o painel admin. Criei páginas de login e registro, e protegi todas as rotas /admin/* com middleware de auth.
```

---

## 📋 Prompts Originais (Como o projeto foi construído)

O projeto foi construído iterativamente no Lovable com os seguintes tipos de prompts:

1. **Setup inicial**: "Cria um painel admin para rastreamento de leads WhatsApp com Facebook Pixel"
2. **Evolution API**: "Integra com a Evolution API para conectar números WhatsApp, mostrar QR Code, e sincronizar grupos"
3. **Campanhas**: "Cria CRUD de campanhas vinculadas a grupos WhatsApp com landing page para redirect"
4. **Pixels**: "Cria gestão de pixels do Facebook com Pixel ID e Access Token da CAPI"
5. **Webhook**: "Quando alguém entrar no grupo WhatsApp, dispara evento GrupoEntrada para o Facebook CAPI via server-side"
6. **Telegram**: "Adiciona integração com Telegram para rastrear entradas em canais/grupos"
7. **Mensagem Recebida**: "Quando alguém enviar mensagem com uma keyword específica pro WhatsApp, dispara evento MensagemRecebida para o pixel"
8. **Melhorias contínuas**: Edição de registros, test_event_code, verificação de status, formatação, etc.

> **Nota**: O frontend é editado e visualizado no Lovable. O backend (Edge Functions, banco de dados, secrets) roda no Lovable Cloud. O código é sincronizado automaticamente com o GitHub.

---

*Última atualização: Março 2026*

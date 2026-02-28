

# Plano: Mensagem Recebida (Tracking por Keyword WhatsApp)

## Resumo

Novo tipo de conversao: quando alguem envia uma mensagem com uma keyword especifica para a instancia WhatsApp, o sistema dispara o evento para o Facebook Pixel/CAPI.

---

## O que sera feito

### 1. Nova tabela: `mensagem_gatilhos`

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | PK |
| nome | text | Nome do evento (ex: "Primeira Mensagem - ENTREI") |
| instance_name | text | Nome da instancia Evolution |
| keyword | text | Texto gatilho (ex: "ENTREI") |
| pixel_id | uuid | FK para pixels (opcional) |
| ativo | boolean | Default true |
| created_at | timestamp | Data de criacao |

RLS: permissivo para todas as operacoes (mesmo padrao das outras tabelas).

### 2. Atualizar webhook da Evolution API

Atualmente o `webhook-evolution` so processa `GROUP_PARTICIPANTS_UPDATE`. Sera expandido para tambem processar o evento `MESSAGES_UPSERT` (mensagem recebida).

Fluxo ao receber mensagem:
1. Verificar se e evento `MESSAGES_UPSERT` ou `messages.upsert`
2. Extrair texto da mensagem e telefone do remetente
3. Buscar na tabela `mensagem_gatilhos` se alguma keyword bate (case-insensitive, match exato ou `includes`)
4. Se bater, buscar pixel associado ao gatilho
5. Enviar evento `MensagemRecebida` para Facebook CAPI
6. Salvar na tabela `eventos` com `fonte = 'mensagem'`

### 3. Atualizar webhook da Evolution API (evolution-api function)

Adicionar `MESSAGES_UPSERT` na lista de eventos do webhook para que a instancia envie mensagens recebidas.

### 4. Nova pagina: `/admin/mensagem-recebida`

Interface para gerenciar gatilhos:
- Listar gatilhos cadastrados (nome, instancia, keyword, pixel, status)
- Criar novo gatilho (formulario com nome, instance_name, keyword, pixel)
- Editar/excluir gatilhos
- Toggle ativo/inativo

### 5. Atualizar navegacao

- Adicionar link "Msg Recebida" no `AdminLayout` com icone `MessageSquare`
- Adicionar rota `/admin/mensagem-recebida` no `App.tsx`

### 6. Atualizar config.toml

O `webhook-evolution` ja tem `verify_jwt = false` (esta no config existente implicitamente). Nao precisa mudar.

---

## Fluxo Tecnico

```text
WhatsApp (usuario envia "ENTREI")
       |
       | Evolution API webhook
       v
webhook-evolution (Edge Function)
       |
       | 1. Detecta evento MESSAGES_UPSERT
       | 2. Extrai texto + telefone
       | 3. Busca keyword em mensagem_gatilhos
       | 4. Match? -> Busca pixel do gatilho
       | 5. Envia "MensagemRecebida" para Facebook CAPI
       | 6. Salva evento com fonte='mensagem'
       v
  Facebook Pixel + DB
```

---

## Arquivos a criar/modificar

| Arquivo | Acao |
|---------|------|
| Migration SQL | Criar tabela `mensagem_gatilhos` |
| `supabase/functions/webhook-evolution/index.ts` | Expandir para processar MESSAGES_UPSERT |
| `supabase/functions/evolution-api/index.ts` | Adicionar MESSAGES_UPSERT nos eventos do webhook |
| `src/pages/admin/MensagemRecebida.tsx` | Criar pagina de gestao |
| `src/App.tsx` | Adicionar rota |
| `src/components/admin/AdminLayout.tsx` | Adicionar link no menu |


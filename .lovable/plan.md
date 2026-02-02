
# Plano: Melhorar Página de Instâncias

## Resumo
Adicionar funcionalidades para verificar status de conexão e tornar mais visível o número WhatsApp e opções de sincronização.

---

## Mudanças na Interface

### 1. Adicionar Botão "Verificar Conexão"
- Novo botão com ícone de WiFi para verificar se a instância está conectada
- Ao clicar, chama a API de status e atualiza o banco com o resultado
- Se conectado, busca e salva o número do WhatsApp automaticamente
- Mostra loading enquanto verifica

### 2. Melhorar Exibição do Número
- Mostrar o número formatado de forma mais clara (ex: +55 81 9XXXX-XXXX)
- Se não tiver número, mostrar "Não identificado" ao invés de "-"
- Atualizar o número ao verificar conexão

### 3. Renomear Botões com Tooltips
- Botão Sincronizar: tooltip "Sincronizar Grupos"
- Botão Verificar: tooltip "Verificar Conexão"
- Botão QR Code: tooltip "Reconectar"
- Botão Excluir: tooltip "Excluir Instância"

---

## Mudanças Visuais na Tabela

```text
+----------------+-------------------+--------------+--------+---------------------------+
| Nome           | Número            | Status       | Grupos | Ações                     |
+----------------+-------------------+--------------+--------+---------------------------+
| WhatsApp Vendas| +55 81 99999-9999 | 🟢 Conectado | 5      | [WiFi] [Sync] [🗑️]       |
+----------------+-------------------+--------------+--------+---------------------------+
| WhatsApp Suport| Não identificado  | 🔴 Desconect | 0      | [QR] [WiFi] [Sync] [🗑️]  |
+----------------+-------------------+--------------+--------+---------------------------+
```

**Legenda dos botões:**
- [WiFi] = Verificar Conexão
- [Sync] = Sincronizar Grupos  
- [QR] = Reconectar (gerar QR Code)
- [🗑️] = Excluir

---

## Detalhes Técnicos

### Nova função: `checkAndUpdateStatus`
```text
1. Chamar edge function evolution-api com action: "status"
2. Se state === "open":
   - Atualizar status para "connected"
   - Buscar e salvar numero_whatsapp
   - Mostrar toast de sucesso
3. Se state !== "open":
   - Atualizar status para "disconnected"
   - Mostrar toast informando desconexão
4. Recarregar lista de instâncias
```

### Arquivos a modificar
- `src/pages/admin/Instancias.tsx`
  - Adicionar estado `checking` para controlar loading do botão
  - Adicionar função `checkAndUpdateStatus`
  - Adicionar botão de verificar na coluna de ações
  - Adicionar Tooltip nos botões
  - Formatar número do WhatsApp para exibição

### Importações necessárias
- Adicionar `Tooltip` do Radix UI

---

## Resultado Esperado

1. O usuário poderá clicar em "Verificar Conexão" a qualquer momento
2. O número do WhatsApp aparecerá corretamente após verificar
3. Status será atualizado em tempo real
4. Interface mais clara com tooltips explicativos

---

## Segurança

Nenhuma mudança no backend ou banco de dados necessária - apenas melhorias na interface.

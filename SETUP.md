# CapitalCred — Guia de Configuração

## 1. Banco de dados (Supabase)

1. Acesse **supabase.com** → seu projeto
2. Vá em **SQL Editor → New query**
3. Cole o conteúdo de `supabase_schema.sql` e clique **Run**

> O schema v2 corrige a ordem das tabelas (listas antes de clientes) que causava falha ao inserir clientes.

---

## 2. Habilitar Realtime (chat)

Supabase → **Database → Replication → supabase_realtime**
Confirme que a tabela **`mensagens`** está marcada com toggle ativo.

---

## 3. Login com Google — configuração obrigatória

### 3a. Google Cloud Console

1. Acesse **console.cloud.google.com**
2. Crie ou selecione um projeto
3. Menu → **APIs e serviços → Tela de consentimento OAuth** → configure (tipo Externo)
4. Menu → **Credenciais → Criar credencial → ID do cliente OAuth 2.0**
   - Tipo: **Aplicativo da Web**
   - Nome: CapitalCred
5. Deixe em aberto — você vai adicionar o redirect URI no próximo passo

### 3b. Supabase — ativar provedor Google

1. Supabase → **Authentication → Providers → Google**
2. Habilite o toggle
3. Copie a **Callback URL** mostrada (algo como `https://xxx.supabase.co/auth/v1/callback`)
4. Volte ao Google Cloud Console e adicione essa URL em **URIs de redirecionamento autorizados**
5. Copie o **Client ID** e **Client Secret** do Google e cole no Supabase
6. Salve

---

## 4. Criar o primeiro usuário Admin

**Opção A — via painel (recomendado):**

1. Supabase → **Authentication → Users → Add user**
2. E-mail: `admin@capitalcred.com` | Senha: `123456`
3. Em **User metadata** adicione:
   ```json
   { "nome": "Administrador", "role": "admin" }
   ```

**Opção B — via SQL (para o Gmail do admin usar Google login também):**

```sql
INSERT INTO public.approved_emails (email, role, nome)
VALUES ('seuemail@gmail.com', 'admin', 'Administrador');
```

---

## 5. Autorizar consultores para login Google

Após logar como admin, vá em **Configurações → Acessos Google** e adicione os e-mails dos consultores. Eles só conseguem entrar com Google se o e-mail estiver nessa lista.

---

## 6. Deploy no Vercel

1. Acesse **vercel.com** → **Add New Project**
2. Importe a pasta do projeto (ou suba via GitHub)
3. Clique **Deploy** — nenhuma configuração extra necessária

---

## Estrutura do banco

```
profiles        → usuários (nome, role, avatar)
approved_emails → e-mails autorizados para Google login
listas          → listas de distribuição (FK → profiles)
clientes        → clientes cadastrados (FK → profiles, listas)
mensagens       → chat em tempo real (Caixa | Santander)
comissoes       → registro de pagamento de PS
```

## Segurança (RLS)

| Tabela | Admin | Consultor |
|---|---|---|
| profiles | lê todos | lê todos, edita próprio |
| approved_emails | CRUD total | só lê o próprio e-mail |
| clientes | CRUD total | CRUD nos seus |
| listas | CRUD total | lê as atribuídas a ele |
| mensagens | lê/insere | lê/insere |
| comissoes | CRUD total | lê dos seus clientes |

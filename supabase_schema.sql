-- ============================================================
--  CapitalCred — Supabase Schema (v3)
--  Execute no SQL Editor do seu projeto Supabase
--  ATENÇÃO: ordem correta das tabelas para evitar FK circular
-- ============================================================

-- ── 0. Extensões ────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ============================================================
-- 1. TABELA: profiles
-- ============================================================
create table if not exists public.profiles (
  id         uuid        primary key references auth.users(id) on delete cascade,
  nome       text        not null,
  email      text        not null,
  role       text        not null default 'consultor' check (role in ('admin','consultor','operacional')),
  avatar     text        not null default 'U',
  avatar_url text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 2. TABELA: approved_emails
--    Admin adiciona os e-mails que podem logar via Google.
--    O trigger usa esta tabela para definir o cargo.
-- ============================================================
create table if not exists public.approved_emails (
  id         uuid        primary key default uuid_generate_v4(),
  email      text        not null unique,
  role       text        not null default 'consultor' check (role in ('admin','consultor','operacional')),
  nome       text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 3. TABELA: listas  (precisa existir antes de clientes por causa da FK)
-- ============================================================
create table if not exists public.listas (
  id           uuid        primary key default uuid_generate_v4(),
  nome         text        not null,
  banco        text        not null check (banco in ('Caixa','Santander')),
  consultor_id uuid        references public.profiles(id) on delete set null,
  data         date        not null default current_date,
  created_at   timestamptz not null default now()
);

-- ============================================================
-- 4. TABELA: clientes
-- ============================================================
create table if not exists public.clientes (
  id           uuid          primary key default uuid_generate_v4(),
  nome         text          not null,
  cpf          text          not null default '-',
  cidade       text          not null default '-',
  banco        text          not null check (banco in ('Caixa','Santander')),
  valor        numeric(14,2) not null default 0,
  ps           numeric(14,2) not null default 0,
  consultor_id uuid          references public.profiles(id) on delete set null,
  lista_id     uuid          references public.listas(id) on delete set null,
  data         date          not null default current_date,
  created_at   timestamptz   not null default now()
);

-- ============================================================
-- 5. TABELA: mensagens
-- ============================================================
create table if not exists public.mensagens (
  id              uuid        primary key default uuid_generate_v4(),
  canal           text        not null check (canal in ('Caixa','Santander')),
  user_id         uuid        not null references public.profiles(id) on delete cascade,
  user_nome       text        not null,
  texto           text,
  image_url       text,
  reply_to_id     uuid        references public.mensagens(id) on delete set null,
  reply_to_nome   text,
  reply_to_texto  text,
  created_at      timestamptz not null default now()
);

-- ============================================================
-- 6. TABELA: comissoes
-- ============================================================
create table if not exists public.comissoes (
  id         uuid          primary key default uuid_generate_v4(),
  cliente_id uuid          not null references public.clientes(id) on delete cascade,
  ps         numeric(14,2) not null default 0,
  status     text          not null default 'Pendente' check (status in ('Pendente','Pago')),
  created_at timestamptz   not null default now()
);

-- ============================================================
-- 7. Índices
-- ============================================================
create index if not exists idx_clientes_consultor on public.clientes(consultor_id);
create index if not exists idx_clientes_banco     on public.clientes(banco);
create index if not exists idx_clientes_lista     on public.clientes(lista_id);
create index if not exists idx_mensagens_canal    on public.mensagens(canal);
create index if not exists idx_mensagens_created  on public.mensagens(created_at);
create index if not exists idx_comissoes_cliente  on public.comissoes(cliente_id);
create index if not exists idx_listas_consultor   on public.listas(consultor_id);
create index if not exists idx_approved_email     on public.approved_emails(email);

-- ============================================================
-- 8. Row Level Security (RLS)
-- ============================================================
alter table public.profiles        enable row level security;
alter table public.approved_emails enable row level security;
alter table public.clientes        enable row level security;
alter table public.listas          enable row level security;
alter table public.mensagens       enable row level security;
alter table public.comissoes       enable row level security;

-- ── Helper: verifica se o usuário é admin ───────────────────
create or replace function public.is_admin()
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ── profiles ────────────────────────────────────────────────
drop policy if exists "profiles: leitura para autenticados" on public.profiles;
drop policy if exists "profiles: editar próprio"            on public.profiles;
drop policy if exists "profiles: insert via trigger"        on public.profiles;

create policy "profiles: leitura para autenticados"
  on public.profiles for select
  using (auth.role() = 'authenticated');

create policy "profiles: editar próprio"
  on public.profiles for update
  using (id = auth.uid());

create policy "profiles: insert via trigger"
  on public.profiles for insert
  with check (true);  -- trigger roda como security definer

-- ── approved_emails ─────────────────────────────────────────
drop policy if exists "approved_emails: admin tudo"       on public.approved_emails;
drop policy if exists "approved_emails: verificar próprio" on public.approved_emails;

-- Só admin gerencia
create policy "approved_emails: admin tudo"
  on public.approved_emails for all
  using (public.is_admin())
  with check (public.is_admin());

-- Usuário autenticado pode verificar se o próprio e-mail está aprovado
create policy "approved_emails: verificar próprio"
  on public.approved_emails for select
  using (
    email = (select email from auth.users where id = auth.uid())
  );

-- ── clientes ────────────────────────────────────────────────
drop policy if exists "clientes: admin vê tudo"          on public.clientes;
drop policy if exists "clientes: consultor vê os seus"   on public.clientes;
drop policy if exists "clientes: inserir"                on public.clientes;
drop policy if exists "clientes: admin atualiza tudo"    on public.clientes;
drop policy if exists "clientes: consultor atualiza os seus" on public.clientes;
drop policy if exists "clientes: admin exclui tudo"      on public.clientes;
drop policy if exists "clientes: consultor exclui os seus"   on public.clientes;

create policy "clientes: admin vê tudo"
  on public.clientes for select
  using (public.is_admin());

create policy "clientes: consultor vê os seus"
  on public.clientes for select
  using (consultor_id = auth.uid());

create policy "clientes: inserir"
  on public.clientes for insert
  with check (auth.role() = 'authenticated');

create policy "clientes: admin atualiza tudo"
  on public.clientes for update
  using (public.is_admin());

create policy "clientes: consultor atualiza os seus"
  on public.clientes for update
  using (consultor_id = auth.uid());

create policy "clientes: admin exclui tudo"
  on public.clientes for delete
  using (public.is_admin());

create policy "clientes: consultor exclui os seus"
  on public.clientes for delete
  using (consultor_id = auth.uid());

-- ── listas ──────────────────────────────────────────────────
drop policy if exists "listas: admin tudo"        on public.listas;
drop policy if exists "listas: consultor lê as suas" on public.listas;

create policy "listas: admin tudo"
  on public.listas for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "listas: consultor lê as suas"
  on public.listas for select
  using (consultor_id = auth.uid());

-- ── mensagens ───────────────────────────────────────────────
drop policy if exists "mensagens: leitura" on public.mensagens;
drop policy if exists "mensagens: inserir" on public.mensagens;

create policy "mensagens: leitura"
  on public.mensagens for select
  using (auth.role() = 'authenticated');

create policy "mensagens: inserir"
  on public.mensagens for insert
  with check (auth.role() = 'authenticated');

-- ── comissoes ───────────────────────────────────────────────
drop policy if exists "comissoes: admin tudo"          on public.comissoes;
drop policy if exists "comissoes: consultor lê as suas" on public.comissoes;

create policy "comissoes: admin tudo"
  on public.comissoes for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "comissoes: consultor lê as suas"
  on public.comissoes for select
  using (
    exists (
      select 1 from public.clientes c
      where c.id = cliente_id and c.consultor_id = auth.uid()
    )
  );

-- ============================================================
-- 9. Trigger: cria profile ao registrar (e-mail/senha ou Google)
--    Para logins Google, o role vem da tabela approved_emails.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  _nome text;
  _role text;
  _av   text;
begin
  -- Para login Google, busca o role pré-aprovado
  select role into _role
  from public.approved_emails
  where email = new.email;

  -- Fallback: metadados do signup (e-mail/senha) ou 'consultor'
  _nome := coalesce(
    new.raw_user_meta_data->>'full_name',   -- Google OAuth
    new.raw_user_meta_data->>'nome',        -- signup manual
    split_part(new.email, '@', 1)
  );
  _role := coalesce(_role, new.raw_user_meta_data->>'role', 'consultor');
  _av   := upper(substring(_nome, 1, 1));

  insert into public.profiles (id, nome, email, role, avatar)
  values (new.id, _nome, new.email, _role, _av)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- 10. Realtime — broadcast para mensagens
-- ============================================================
do $$
begin
  begin
    alter publication supabase_realtime add table public.mensagens;
  exception when others then
    null; -- tabela já estava na publicação
  end;
end $$;

-- ============================================================
-- APÓS RODAR ESTE SQL:
--
-- 1. Vá em Supabase → Authentication → Providers → Google
--    → Habilite e cole seu Google Client ID e Secret
--
-- 2. Copie a "Callback URL" mostrada lá e adicione em:
--    Google Cloud Console → Credenciais → URIs de redirecionamento
--
-- 3. Crie o admin via Authentication → Users → Add user
--    Metadados: { "nome": "Administrador", "role": "admin" }
--
-- 4. Para o admin poder usar Google login, adicione o gmail dele
--    na tabela approved_emails (role: 'admin') via SQL Editor:
--    INSERT INTO public.approved_emails (email, role, nome)
--    VALUES ('admin@gmail.com', 'admin', 'Administrador');
-- ============================================================

-- ============================================================
-- v3 MIGRATION — execute mesmo se já tiver rodado o v2
-- ============================================================

-- Helper: verifica se é operacional (precisa existir antes das políticas que a usam)
create or replace function public.is_operacional()
returns boolean language sql security definer as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'operacional');
$$;

-- ── Tabela: vendas ──────────────────────────────────────────
create table if not exists public.vendas (
  id           uuid          primary key default uuid_generate_v4(),
  cliente_nome text          not null,
  banco        text          check (banco in ('Caixa','Santander')),
  valor        numeric(14,2) not null default 0,
  ps           numeric(14,2) not null default 0,
  status       text          not null default 'pendente' check (status in ('pendente','concluida','cancelada')),
  consultor_id uuid          references public.profiles(id) on delete set null,
  data         date          not null default current_date,
  created_at   timestamptz   not null default now()
);
alter table public.vendas enable row level security;
drop policy if exists "vendas: admin tudo"          on public.vendas;
drop policy if exists "vendas: consultor os seus"   on public.vendas;
create policy "vendas: admin tudo"        on public.vendas for all using (public.is_admin()) with check (public.is_admin());
create policy "vendas: consultor os seus" on public.vendas for all using (consultor_id = auth.uid()) with check (consultor_id = auth.uid());
create policy "vendas: operacional lê"       on public.vendas for select using (public.is_operacional());

-- ── Tabela: captacao ─────────────────────────────────────────
create table if not exists public.captacao (
  id           uuid        primary key default uuid_generate_v4(),
  nome         text        not null,
  telefone     text,
  banco        text        check (banco in ('Caixa','Santander')),
  origem       text,
  status       text        not null default 'novo' check (status in ('novo','contato','qualificado','perdido')),
  consultor_id uuid        references public.profiles(id) on delete set null,
  obs          text,
  data         date        not null default current_date,
  created_at   timestamptz not null default now()
);
alter table public.captacao enable row level security;
drop policy if exists "captacao: admin tudo"        on public.captacao;
drop policy if exists "captacao: consultor os seus" on public.captacao;
create policy "captacao: admin tudo"        on public.captacao for all using (public.is_admin()) with check (public.is_admin());
create policy "captacao: consultor os seus" on public.captacao for all using (consultor_id = auth.uid()) with check (consultor_id = auth.uid());
create policy "captacao: operacional lê"       on public.captacao for select using (public.is_operacional());

-- Novas colunas (seguro se já existirem)
alter table public.clientes    add column if not exists crm_status text not null default 'negociando' check (crm_status in ('negociando','documentos','fechado','pago','ps_pago','desistiu'));
alter table public.profiles    add column if not exists avatar_url text;
alter table public.mensagens   add column if not exists image_url      text;
alter table public.mensagens   add column if not exists reply_to_id    uuid references public.mensagens(id) on delete set null;
alter table public.mensagens   add column if not exists reply_to_nome  text;
alter table public.mensagens   add column if not exists reply_to_texto text;
alter table public.mensagens   alter column texto drop not null;

-- Atualiza check de role para incluir 'operacional'
alter table public.profiles       drop constraint if exists profiles_role_check;
alter table public.profiles       add  constraint profiles_role_check check (role in ('admin','consultor','operacional'));
alter table public.approved_emails drop constraint if exists approved_emails_role_check;
alter table public.approved_emails add  constraint approved_emails_role_check check (role in ('admin','consultor','operacional'));

-- Auxiliar pode ver todos os clientes (read-only)
drop policy if exists "clientes: operacional vê tudo" on public.clientes;
create policy "clientes: operacional vê tudo"
  on public.clientes for select
  using (public.is_operacional());

-- Auxiliar pode ver todas as listas (read-only)
drop policy if exists "listas: operacional lê todas" on public.listas;
create policy "listas: operacional lê todas"
  on public.listas for select
  using (public.is_operacional());

-- ============================================================
-- STORAGE (execute após criar os buckets no dashboard)
-- Supabase → Storage → New bucket → "chat-media" (public: ON)
-- Depois cole estas policies:
-- ============================================================
-- insert into storage.buckets (id, name, public) values ('chat-media', 'chat-media', true) on conflict do nothing;
-- create policy "chat-media: authenticated upload" on storage.objects for insert to authenticated with check (bucket_id = 'chat-media');
-- create policy "chat-media: public read" on storage.objects for select using (bucket_id = 'chat-media');
-- ============================================================

-- ============================================================
-- v4 MIGRATION — novos recursos
-- Execute no SQL Editor mesmo se já tiver rodado as versões anteriores
-- ============================================================

-- ── Novas colunas em clientes ─────────────────────────────────
alter table public.clientes add column if not exists telefone      text;
alter table public.clientes add column if not exists email         text;
alter table public.clientes add column if not exists endereco      text;
alter table public.clientes add column if not exists produto       text;
alter table public.clientes add column if not exists notas         text;
alter table public.clientes add column if not exists follow_up     boolean not null default false;
alter table public.clientes add column if not exists data_retorno  date;
alter table public.clientes add column if not exists motivo_retorno text;

-- ── Novas colunas em vendas ───────────────────────────────────
alter table public.vendas add column if not exists comissao_pct   numeric(5,2)  not null default 37;
alter table public.vendas add column if not exists comissao_valor numeric(14,2) not null default 0;
alter table public.vendas add column if not exists data_pagamento date;
alter table public.vendas add column if not exists client_id      uuid references public.clientes(id) on delete set null;
alter table public.vendas add column if not exists produto        text;

-- ── Novas colunas em mensagens (simulação + sala) ─────────────
alter table public.mensagens add column if not exists tipo               text not null default 'text' check (tipo in ('text','simulation','image'));
alter table public.mensagens add column if not exists simulacao          jsonb;
alter table public.mensagens add column if not exists simulacao_status   text default 'pending' check (simulacao_status in ('pending','in_progress','done','rejected'));
alter table public.mensagens add column if not exists simulacao_resposta text;
alter table public.mensagens add column if not exists sala_id            uuid;

-- ── Tabela: salas (chat rooms customizados) ───────────────────
create table if not exists public.salas (
  id             uuid        primary key default uuid_generate_v4(),
  nome           text        not null,
  descricao      text,
  cor            text        not null default 'indigo',
  supervisor_id  uuid        references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);
alter table public.salas enable row level security;
drop policy if exists "salas: leitura autenticados" on public.salas;
drop policy if exists "salas: admin tudo"           on public.salas;
create policy "salas: leitura autenticados" on public.salas for select using (auth.role() = 'authenticated');
create policy "salas: admin tudo"           on public.salas for all   using (public.is_admin()) with check (public.is_admin());

-- adiciona FK de mensagens → salas após a tabela existir
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'mensagens_sala_id_fkey'
    and table_name = 'mensagens'
    and table_schema = 'public'
  ) then
    alter table public.mensagens
      add constraint mensagens_sala_id_fkey
      foreign key (sala_id) references public.salas(id) on delete set null;
  end if;
end $$;

-- ── Tabela: metas (goals) ─────────────────────────────────────
create table if not exists public.metas (
  id           uuid          primary key default uuid_generate_v4(),
  consultor_id uuid          not null references public.profiles(id) on delete cascade,
  seller_name  text          not null,
  month        smallint      not null check (month between 1 and 12),
  year         int           not null,
  meta_valor   numeric(14,2) not null default 0,
  created_at   timestamptz   not null default now(),
  unique (consultor_id, month, year)
);
alter table public.metas enable row level security;
drop policy if exists "metas: admin tudo"       on public.metas;
drop policy if exists "metas: consultor seus"   on public.metas;
drop policy if exists "metas: leitura todos"    on public.metas;
create policy "metas: admin tudo"     on public.metas for all using (public.is_admin())              with check (public.is_admin());
create policy "metas: consultor seus" on public.metas for all using (consultor_id = auth.uid())      with check (consultor_id = auth.uid());
create policy "metas: leitura todos"  on public.metas for select using (auth.role() = 'authenticated');

-- ── Tabela: crm_documentos ───────────────────────────────────
create table if not exists public.crm_documentos (
  id           uuid        primary key default uuid_generate_v4(),
  cliente_id   uuid        not null references public.clientes(id) on delete cascade,
  arquivo_url  text        not null,
  arquivo_nome text        not null,
  descricao    text,
  uploader_id  uuid        references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
alter table public.crm_documentos enable row level security;
drop policy if exists "crm_docs: admin tudo"      on public.crm_documentos;
drop policy if exists "crm_docs: consultor seus"  on public.crm_documentos;
create policy "crm_docs: admin tudo"
  on public.crm_documentos for all
  using (public.is_admin()) with check (public.is_admin());
create policy "crm_docs: consultor seus"
  on public.crm_documentos for all
  using  (exists (select 1 from public.clientes c where c.id = cliente_id and c.consultor_id = auth.uid()))
  with check (exists (select 1 from public.clientes c where c.id = cliente_id and c.consultor_id = auth.uid()));

-- ── Tabela: lead_contatos (status por lead dentro de listas) ──
create table if not exists public.lead_contatos (
  id           uuid        primary key default uuid_generate_v4(),
  lista_id     uuid        not null references public.listas(id) on delete cascade,
  nome         text        not null,
  cpf          text,
  telefone     text,
  status       text        not null default 'contacted' check (status in ('contacted','added_to_crm','no_answer','not_interested')),
  crm_id       uuid        references public.clientes(id) on delete set null,
  obs          text,
  consultor_id uuid        references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
alter table public.lead_contatos enable row level security;
drop policy if exists "lead_contatos: admin tudo"     on public.lead_contatos;
drop policy if exists "lead_contatos: consultor seus" on public.lead_contatos;
create policy "lead_contatos: admin tudo"
  on public.lead_contatos for all
  using (public.is_admin()) with check (public.is_admin());
create policy "lead_contatos: consultor seus"
  on public.lead_contatos for all
  using (consultor_id = auth.uid()) with check (consultor_id = auth.uid());

-- ── Realtime para salas ───────────────────────────────────────
do $$
begin
  begin
    alter publication supabase_realtime add table public.salas;
  exception when others then null;
  end;
end $$;

-- ============================================================
-- APÓS RODAR ESTA MIGRATION:
-- 1. Criar bucket "chat-media" se ainda não existir (público)
-- 2. Executar as policies de storage descritas acima
-- ============================================================

-- myPlan: lembretes e base para o agente pessoal (servidor MCP)
-- Tabelas novas em português. As tabelas existentes não mudam de nome.

-- Contagem por projeto passa a expor o dono, para o servidor do agente filtrar por usuário.
-- (create or replace view só aceita colunas novas no fim)
create or replace view project_task_counts with (security_invoker = true) as
select
  project_id,
  count(*)::int                              as task_count,
  count(*) filter (where completed)::int     as done_count,
  user_id
from tasks
group by project_id, user_id;

-- Lembretes -----------------------------------------------------------------

create table lembretes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tarefa_id   uuid references tasks (id) on delete cascade,
  projeto_id  uuid references projects (id) on delete cascade,
  texto       text not null check (char_length(texto) between 1 and 500),
  quando      timestamptz not null,
  status      text not null default 'pendente' check (status in ('pendente', 'agendado', 'enviado', 'cancelado')),
  origem      text not null default 'app' check (origem in ('app', 'agente')),
  agendado_em timestamptz,
  enviado_em  timestamptz,
  criado_em   timestamptz not null default now()
);

create index lembretes_usuario_status_quando_idx on lembretes (user_id, status, quando);
create index lembretes_tarefa_idx on lembretes (tarefa_id);

-- Tokens do agente ------------------------------------------------------------
-- O token em texto puro aparece uma única vez, na criação. Aqui fica só o
-- HMAC-SHA256 dele com MCP_SEGREDO_TOKENS.

create table tokens_agente (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome          text not null check (char_length(nome) between 1 and 60),
  hash          text not null unique,
  escopo        text not null default 'escrita' check (escopo in ('leitura', 'escrita')),
  expira_em     timestamptz not null,
  ultimo_uso_em timestamptz,
  revogado_em   timestamptz,
  criado_em     timestamptz not null default now()
);

create index tokens_agente_usuario_idx on tokens_agente (user_id, criado_em desc);

-- Registro do que o agente fez --------------------------------------------------

create table registro_agente (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  token_id    uuid references tokens_agente (id) on delete set null,
  ferramenta  text not null,
  entrada     jsonb not null default '{}',
  resultado   jsonb,
  sucesso     boolean not null default true,
  -- o necessário para reverter a ação (null quando não há o que desfazer)
  desfazer    jsonb,
  desfeito_em timestamptz,
  criado_em   timestamptz not null default now()
);

create index registro_agente_usuario_idx on registro_agente (user_id, criado_em desc);

-- Último sinal de vida do agente ------------------------------------------------

create table heartbeats_agente (
  user_id   uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  ultimo_em timestamptz not null default now()
);

-- Row Level Security, no mesmo padrão das tabelas atuais -------------------------

alter table lembretes         enable row level security;
alter table tokens_agente     enable row level security;
alter table registro_agente   enable row level security;
alter table heartbeats_agente enable row level security;

create policy "own lembretes"  on lembretes         for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own tokens"     on tokens_agente     for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own registro"   on registro_agente   for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own heartbeats" on heartbeats_agente for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Permissões explícitas: projetos novos do Supabase podem não expor tabelas novas sozinhos.
grant select, insert, update, delete on lembretes, tokens_agente, registro_agente, heartbeats_agente to authenticated;
grant all on lembretes, tokens_agente, registro_agente, heartbeats_agente to service_role;
grant select on project_task_counts to authenticated, service_role;

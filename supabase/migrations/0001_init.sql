-- myPlan: modelo inicial de dados
-- Rode no SQL Editor do Supabase (ou com `supabase db push`).

create extension if not exists "pgcrypto";

-- Tipos -------------------------------------------------------------------

create type project_kind as enum ('project', 'campaign');
create type project_status as enum ('active', 'paused', 'done');
create type column_kind as enum ('todo', 'doing', 'waiting', 'done');
create type task_priority as enum ('low', 'medium', 'high', 'urgent');

-- Função utilitária para updated_at -----------------------------------------

create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Projetos -----------------------------------------------------------------

create table projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 120),
  description text,
  kind        project_kind not null default 'project',
  status      project_status not null default 'active',
  color       text not null default 'petroleo',
  position    double precision not null default 0,
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index projects_user_idx on projects (user_id, archived_at, position);
create trigger projects_updated_at before update on projects
  for each row execute function set_updated_at();

-- Detalhes de campanha (1:1 com projects quando kind = 'campaign') ------------

create table campaign_details (
  project_id   uuid primary key references projects (id) on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  objective    text,
  starts_on    date,
  ends_on      date,
  channels     text[] not null default '{}',
  -- [{ "id": "uuid", "title": "Post de lançamento", "done": false }]
  deliverables jsonb not null default '[]',
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

-- Colunas do quadro --------------------------------------------------------

create table board_columns (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title      text not null,
  kind       column_kind not null,
  position   double precision not null default 0
);

create index board_columns_project_idx on board_columns (project_id, position);

-- Etiquetas (por projeto) ---------------------------------------------------

create table labels (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 40),
  color      text not null default 'petroleo'
);

create index labels_project_idx on labels (project_id);

-- Tarefas ------------------------------------------------------------------

create table tasks (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references projects (id) on delete cascade,
  column_id    uuid not null references board_columns (id) on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 200),
  description  text,
  due_on       date,
  priority     task_priority not null default 'medium',
  label_ids    uuid[] not null default '{}',
  -- [{ "id": "uuid", "text": "Revisar texto", "done": true }]
  checklist    jsonb not null default '[]',
  -- [{ "id": "uuid", "url": "https://...", "title": "Briefing" }]
  links        jsonb not null default '[]',
  completed    boolean not null default false,
  completed_at timestamptz,
  position     double precision not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index tasks_project_idx on tasks (project_id, column_id, position);
create trigger tasks_updated_at before update on tasks
  for each row execute function set_updated_at();

-- Progresso por projeto (respeita RLS de quem consulta) ------------------------

create view project_task_counts with (security_invoker = true) as
select
  project_id,
  count(*)::int                              as task_count,
  count(*) filter (where completed)::int     as done_count
from tasks
group by project_id;

-- Row Level Security: cada pessoa só enxerga o que é seu -----------------------

alter table projects         enable row level security;
alter table campaign_details enable row level security;
alter table board_columns    enable row level security;
alter table labels           enable row level security;
alter table tasks            enable row level security;

create policy "own projects"  on projects         for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own campaigns" on campaign_details for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own columns"   on board_columns    for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own labels"    on labels           for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own tasks"     on tasks            for all using (user_id = auth.uid()) with check (user_id = auth.uid());

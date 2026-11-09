-- myPlan jurídico, etapa 3: tipos de tarefa, prazo fatal, feriados por tribunal e locais,
-- histórico de alterações de prazo, lembretes automáticos e preferências.
-- Feriados nacionais (fixos e móveis) e o recesso de 20/12 a 20/01 ficam em src/domain/prazos.ts.
--
-- Princípio das cargas: um feriado a mais empurra o vencimento para depois do real e pode
-- fazer o advogado perder o prazo. Na dúvida, o feriado não é carregado.

-- Tarefas: tipo, prazo fatal e memória do cálculo ------------------------------------
-- due_on continua sendo o campo das telas; num prazo, guarda o prazo interno.
-- contagem: {inicio, meio, dias, unidade, regra, emDobro, tribunal, margem, vencimento,
--            feriadosConsiderados: [{data, motivo}], memoria}

alter table tasks
  add column tipo              text not null default 'providencia'
                               check (tipo in ('prazo', 'providencia', 'audiencia')),
  add column prazo_fatal       date,
  add column contagem          jsonb,
  add column local_audiencia   text check (char_length(local_audiencia) <= 200),
  add column horario_audiencia timestamptz;

alter table tasks add constraint tasks_prazo_fatal_so_em_prazo
  check (prazo_fatal is null or tipo = 'prazo');
alter table tasks add constraint tasks_audiencia_so_em_audiencia
  check ((local_audiencia is null and horario_audiencia is null) or tipo = 'audiencia');

create index tasks_usuario_prazo_fatal_idx on tasks (user_id, prazo_fatal) where prazo_fatal is not null;
create index tasks_usuario_audiencia_idx   on tasks (user_id, horario_audiencia) where horario_audiencia is not null;

-- Feriados, suspensões e expediente reduzido -------------------------------------------
-- user_id nulo: geral, carregado por migração, sempre de um tribunal.
-- user_id preenchido: feriado local do advogado, para todos os tribunais (tribunal nulo) ou um só.
-- ate: último dia de um período (nulo quando é um dia só).
-- expediente_reduzido (CPC, art. 224, § 1º): o dia conta, mas se for o do começo ou o do
-- vencimento o prazo passa para o dia útil seguinte. Vale também para indisponibilidade do sistema.

create table feriados (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid default auth.uid() references auth.users (id) on delete cascade,
  tribunal  text check (tribunal ~ '^[A-Z0-9]{2,10}$'),
  data      date not null,
  ate       date,
  tipo      text not null default 'feriado' check (tipo in ('feriado', 'suspensao', 'expediente_reduzido')),
  descricao text not null check (char_length(descricao) between 1 and 120),
  fonte     text check (char_length(fonte) <= 200),
  criado_em timestamptz not null default now(),
  check (ate is null or ate > data),
  check (user_id is not null or tribunal is not null)
);

create unique index feriados_unico_idx on feriados (user_id, tribunal, data) nulls not distinct;
create index feriados_tribunal_data_idx on feriados (tribunal, data);
create index feriados_usuario_data_idx  on feriados (user_id, data) where user_id is not null;

-- Carga inicial: TJRS, TRT4 e TRF4, 2026 e 2027. Revisar a cada ano.
-- Nacionais, Carnaval, Sexta-feira Santa e Corpus Christi não entram (domain/prazos.ts).
-- TJRS: só a Data Magna, até conferir o ato do Órgão Especial com os feriados forenses.
-- TRF4: sem a Data Magna, que só vale no RS (o TRF4 cobre RS, SC e PR).

insert into feriados (user_id, tribunal, data, ate, tipo, descricao, fonte) values
  -- TJRS
  (null, 'TJRS', '2026-09-20', null,         'feriado', 'Data Magna do Rio Grande do Sul',  'Lei estadual RS'),
  (null, 'TJRS', '2027-09-20', null,         'feriado', 'Data Magna do Rio Grande do Sul',  'Lei estadual RS'),
  -- TRT4 (Lei 5.010/1966, art. 62, e Portaria TRT4 08/2025)
  (null, 'TRT4', '2026-01-01', '2026-01-06', 'feriado', 'Recesso forense',                  'Lei 5.010/1966, art. 62, I'),
  (null, 'TRT4', '2026-04-01', '2026-04-02', 'feriado', 'Semana Santa',                     'Lei 5.010/1966, art. 62, II'),
  (null, 'TRT4', '2026-08-11', null,         'feriado', 'Dia do Magistrado e do Advogado',  'Lei 5.010/1966, art. 62, IV'),
  (null, 'TRT4', '2026-09-20', null,         'feriado', 'Data Magna do Rio Grande do Sul',  'Lei estadual RS'),
  (null, 'TRT4', '2026-11-01', null,         'feriado', 'Todos os Santos',                  'Lei 5.010/1966, art. 62, IV'),
  (null, 'TRT4', '2026-12-08', null,         'feriado', 'Nossa Senhora da Conceição',       'Lei 5.010/1966, art. 62, IV'),
  (null, 'TRT4', '2026-12-20', '2027-01-06', 'feriado', 'Recesso forense',                  'Lei 5.010/1966, art. 62, I'),
  (null, 'TRT4', '2027-03-24', '2027-03-25', 'feriado', 'Semana Santa',                     'Lei 5.010/1966, art. 62, II'),
  (null, 'TRT4', '2027-08-11', null,         'feriado', 'Dia do Magistrado e do Advogado',  'Lei 5.010/1966, art. 62, IV'),
  (null, 'TRT4', '2027-09-20', null,         'feriado', 'Data Magna do Rio Grande do Sul',  'Lei estadual RS'),
  (null, 'TRT4', '2027-11-01', null,         'feriado', 'Todos os Santos',                  'Lei 5.010/1966, art. 62, IV'),
  (null, 'TRT4', '2027-12-08', null,         'feriado', 'Nossa Senhora da Conceição',       'Lei 5.010/1966, art. 62, IV'),
  (null, 'TRT4', '2027-12-20', '2028-01-06', 'feriado', 'Recesso forense',                  'Lei 5.010/1966, art. 62, I'),
  -- TRF4 (Lei 5.010/1966, art. 62, e calendário de feriados do TRF4 de 2026)
  (null, 'TRF4', '2026-01-01', '2026-01-06', 'feriado', 'Recesso forense',                  'Lei 5.010/1966, art. 62, I'),
  (null, 'TRF4', '2026-04-01', '2026-04-02', 'feriado', 'Semana Santa',                     'Lei 5.010/1966, art. 62, II'),
  (null, 'TRF4', '2026-08-11', null,         'feriado', 'Dia do Magistrado e do Advogado',  'Lei 5.010/1966, art. 62, IV'),
  (null, 'TRF4', '2026-10-30', null,         'feriado', 'Dia do Servidor Público',          'Calendário TRF4 2026'),
  (null, 'TRF4', '2026-11-01', null,         'feriado', 'Todos os Santos',                  'Lei 5.010/1966, art. 62, IV'),
  (null, 'TRF4', '2026-12-08', null,         'feriado', 'Nossa Senhora da Conceição',       'Lei 5.010/1966, art. 62, IV'),
  (null, 'TRF4', '2026-12-20', '2027-01-06', 'feriado', 'Recesso forense',                  'Lei 5.010/1966, art. 62, I'),
  (null, 'TRF4', '2027-03-24', '2027-03-25', 'feriado', 'Semana Santa',                     'Lei 5.010/1966, art. 62, II'),
  (null, 'TRF4', '2027-08-11', null,         'feriado', 'Dia do Magistrado e do Advogado',  'Lei 5.010/1966, art. 62, IV'),
  (null, 'TRF4', '2027-11-01', null,         'feriado', 'Todos os Santos',                  'Lei 5.010/1966, art. 62, IV'),
  (null, 'TRF4', '2027-12-08', null,         'feriado', 'Nossa Senhora da Conceição',       'Lei 5.010/1966, art. 62, IV'),
  (null, 'TRF4', '2027-12-20', '2028-01-06', 'feriado', 'Recesso forense',                  'Lei 5.010/1966, art. 62, I');

-- Histórico de alterações de prazo ------------------------------------------------
-- Sem chave estrangeira para tasks: o histórico continua depois que a tarefa é excluída.
-- Só o gatilho grava (security definer); o app e o agente apenas leem.

create table registro_alteracoes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entidade    text not null check (entidade in ('tarefa')),
  entidade_id uuid not null,
  campo       text not null check (campo in ('due_on', 'prazo_fatal')),
  antes       text,
  depois      text,
  origem      text not null default 'app' check (origem in ('app', 'agente')),
  criado_em   timestamptz not null default now()
);

create index registro_alteracoes_entidade_idx on registro_alteracoes (user_id, entidade, entidade_id, criado_em desc);

-- O agente grava com a chave de serviço (papel service_role); a sessão do app, como authenticated.
create or replace function registrar_alteracao_de_prazo() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_origem text := case when auth.role() = 'service_role' then 'agente' else 'app' end;
begin
  if tg_op = 'INSERT' or new.due_on is distinct from old.due_on then
    if not (tg_op = 'INSERT' and new.due_on is null) then
      insert into registro_alteracoes (user_id, entidade, entidade_id, campo, antes, depois, origem)
      values (new.user_id, 'tarefa', new.id, 'due_on',
              case when tg_op = 'UPDATE' then old.due_on::text end, new.due_on::text, v_origem);
    end if;
  end if;
  if tg_op = 'INSERT' or new.prazo_fatal is distinct from old.prazo_fatal then
    if not (tg_op = 'INSERT' and new.prazo_fatal is null) then
      insert into registro_alteracoes (user_id, entidade, entidade_id, campo, antes, depois, origem)
      values (new.user_id, 'tarefa', new.id, 'prazo_fatal',
              case when tg_op = 'UPDATE' then old.prazo_fatal::text end, new.prazo_fatal::text, v_origem);
    end if;
  end if;
  return new;
end $$;

create trigger tasks_registrar_prazo after insert or update of due_on, prazo_fatal on tasks
  for each row execute function registrar_alteracao_de_prazo();

-- Lembretes automáticos --------------------------------------------------------------
-- Marca os lembretes criados pelo prazo (D-3, D-1 e no dia, contados do prazo fatal),
-- para recriá-los quando o prazo muda sem mexer nos que o advogado criou à mão.

alter table lembretes add column automatico text check (automatico in ('d-3', 'd-1', 'dia'));
create unique index lembretes_automatico_idx on lembretes (tarefa_id, automatico)
  where automatico is not null and status in ('pendente', 'agendado');

-- Preferências -------------------------------------------------------------------------

create table preferencias (
  user_id              uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  margem_prazo_interno smallint not null default 2 check (margem_prazo_interno between 0 and 30),
  atualizado_em        timestamptz not null default now()
);

create trigger preferencias_atualizado_em before update on preferencias
  for each row execute function set_atualizado_em();

-- Row Level Security ---------------------------------------------------------------

alter table feriados            enable row level security;
alter table registro_alteracoes enable row level security;
alter table preferencias        enable row level security;

-- Feriados: lê os gerais e os próprios; grava, altera e exclui só os próprios.
create policy "ler feriados"     on feriados for select using (user_id is null or user_id = auth.uid());
create policy "criar feriados"   on feriados for insert with check (user_id = auth.uid());
create policy "alterar feriados" on feriados for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "excluir feriados" on feriados for delete using (user_id = auth.uid());

-- Histórico: o dono só lê. Quem grava é o gatilho.
create policy "ler alteracoes" on registro_alteracoes for select using (user_id = auth.uid());

create policy "own preferencias" on preferencias for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Permissões explícitas, como na 0003 e na 0004 ------------------------------------
-- O Supabase dá todos os privilégios nas tabelas novas a anon e authenticated (default privileges).
-- Aqui eles são retirados antes, para o histórico ficar só com leitura e o anon sem acesso.

revoke all on feriados, registro_alteracoes, preferencias from anon, authenticated;
grant select, insert, update, delete on feriados, preferencias to authenticated;
grant select on registro_alteracoes to authenticated;
grant all on feriados, registro_alteracoes, preferencias to service_role;

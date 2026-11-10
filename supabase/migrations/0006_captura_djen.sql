-- ============================================================================================
-- NÃO EXECUTADA. Escrita na etapa 5, fatia 1 (10/11/2026), sem Docker na máquina de trabalho.
-- Ainda não foi aplicada no Supabase local nem em produção, e o supabase/testes/djen-banco-local.test.ts
-- ainda não rodou. A branch juridico/etapa-5-captura não deve ser mergeada antes de:
--   1. npx supabase start && npx supabase db reset (aplica 0001 a 0006 do zero);
--   2. npm run test:banco-local passar inteiro, inclusive o djen-banco-local.test.ts;
--   3. a aprovação explícita para produção, com backup antes.
-- Pontos a confirmar no local: a extensão pg_cron e o cron.schedule; o upsert com grants por coluna;
-- o gatilho que zera a última consulta quando a OAB muda.
-- ============================================================================================
--
-- Tempestivo, etapa 5 (fatia 1): captura de comunicações do DJEN.
-- A consulta ao DJEN roda na VPS do agente (scripts/captura-djen.ts), nunca na Vercel.
-- O app guarda o estado da captura e as sugestões; nada é enviado ao advogado nesta fatia.

-- Estado da captura por advogado --------------------------------------------------------
-- O advogado (sessão do app) mexe só em ligada, OAB, UF e aceite. O estado da consulta é
-- gravado pelo servidor, com a chave de serviço, a partir das chamadas da VPS.

create table captura_djen (
  user_id             uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  ligada              boolean not null default false,
  numero_oab          text check (numero_oab ~ '^[1-9][0-9]{0,6}$'),
  uf_oab              text check (uf_oab in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA',
                                             'PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')),
  aviso_aceito_em     timestamptz,
  ultima_consulta_ok  date,          -- fim da janela da última consulta que terminou bem
  ultima_tentativa_em timestamptz,
  tentativas_no_dia   smallint not null default 0 check (tentativas_no_dia between 0 and 10),
  ultimo_resultado    text check (ultimo_resultado in ('ok', 'falhou', 'limite', 'em_andamento')),
  atualizado_em       timestamptz not null default now(),
  constraint captura_djen_ligada_completa
    check (not ligada or (numero_oab is not null and uf_oab is not null and aviso_aceito_em is not null))
);

create trigger captura_djen_atualizado_em before update on captura_djen
  for each row execute function set_atualizado_em();

-- Trocar a OAB recomeça a janela (a última consulta boa era de outra OAB). O gatilho muda
-- uma coluna que o advogado não pode gravar direto: o grant vale para as colunas do comando.
create or replace function captura_djen_trocar_oab() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.numero_oab is distinct from old.numero_oab or new.uf_oab is distinct from old.uf_oab then
    new.ultima_consulta_ok := null;
  end if;
  return new;
end $$;

create trigger captura_djen_trocar_oab before update of numero_oab, uf_oab on captura_djen
  for each row execute function captura_djen_trocar_oab();

-- Sugestões vindas do DJEN ----------------------------------------------------------------
-- Só o necessário: nada de teor completo, partes ou outros advogados.

create table comunicacoes_djen (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null default auth.uid() references auth.users (id) on delete cascade,
  djen_id               bigint not null check (djen_id > 0),
  hash                  text check (char_length(hash) <= 100),
  numero_processo       text not null check (numero_processo ~ '^[0-9]{20}$'),
  data_disponibilizacao date not null,
  sigiloso              boolean not null default false,
  tribunal              text check (char_length(tribunal) <= 20),
  orgao                 text check (char_length(orgao) <= 300),
  classe                text check (char_length(classe) <= 200),
  tipo_comunicacao      text check (char_length(tipo_comunicacao) <= 100),
  tipo_documento        text check (char_length(tipo_documento) <= 100),
  link                  text check (char_length(link) <= 1000),
  trecho                text check (char_length(trecho) <= 600),
  dias_situacao         text check (dias_situacao in ('identificados', 'nao_identificados')),
  dias                  smallint check (dias between 1 and 365),
  unidade_dias          text check (unidade_dias in ('uteis', 'corridos')),
  trecho_dias           text check (char_length(trecho_dias) <= 200),
  resumo_teor           text check (resumo_teor ~ '^[0-9a-f]{64}$'),
  status                text not null default 'pendente'
                        check (status in ('pendente', 'registrada', 'descartada', 'cancelada')),
  cancelada_no_djen_em  timestamptz,
  criado_em             timestamptz not null default now(),
  atualizado_em         timestamptz not null default now(),
  constraint comunicacoes_djen_unica unique (user_id, djen_id),
  -- Sigiloso: só id, número e data.
  constraint comunicacoes_djen_sigiloso_sem_teor check (not sigiloso or (
    hash is null and tribunal is null and orgao is null and classe is null and tipo_comunicacao is null
    and tipo_documento is null and link is null and trecho is null and dias_situacao is null
    and dias is null and unidade_dias is null and trecho_dias is null and resumo_teor is null)),
  -- Não sigiloso: sempre diz se achou os dias; dias, unidade e trecho só quando achou.
  constraint comunicacoes_djen_dias_coerentes check (sigiloso or (
    dias_situacao is not null
    and (dias_situacao = 'identificados') = (dias is not null)
    and (dias is null) = (trecho_dias is null)
    and (unidade_dias is null or dias is not null)))
);

create index comunicacoes_djen_status_idx   on comunicacoes_djen (user_id, status, data_disponibilizacao);
create index comunicacoes_djen_retencao_idx on comunicacoes_djen (data_disponibilizacao);

create trigger comunicacoes_djen_atualizado_em before update on comunicacoes_djen
  for each row execute function set_atualizado_em();

-- Retenção ---------------------------------------------------------------------------------
-- Registradas: 1 ano depois da disponibilização (só para não duplicar).
-- Pendentes, descartadas, canceladas e sigilosas: 30 dias. A janela de consulta nunca volta
-- mais de 30 dias (src/domain/djen.ts), então o que foi apagado não volta como novo.

create or replace function limpar_comunicacoes_djen(
  hoje date default (now() at time zone 'America/Sao_Paulo')::date
) returns integer
language sql security definer set search_path = public as $$
  with apagadas as (
    delete from comunicacoes_djen
    where (status <> 'registrada' and data_disponibilizacao < hoje - 30)
       or (status =  'registrada' and data_disponibilizacao < hoje - 365)
    returning 1
  )
  select count(*)::int from apagadas;
$$;

revoke all on function limpar_comunicacoes_djen(date) from public, anon, authenticated;
grant execute on function limpar_comunicacoes_djen(date) to service_role;

create extension if not exists pg_cron;
select cron.schedule('limpar-comunicacoes-djen', '30 9 * * *',   -- 6h30 em Brasília (UTC-3)
                     $$select public.limpar_comunicacoes_djen()$$);

-- Row Level Security ------------------------------------------------------------------------

alter table captura_djen      enable row level security;
alter table comunicacoes_djen enable row level security;

create policy "own captura_djen" on captura_djen for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "ler comunicacoes_djen"     on comunicacoes_djen for select using (user_id = auth.uid());
create policy "alterar comunicacoes_djen" on comunicacoes_djen for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "excluir comunicacoes_djen" on comunicacoes_djen for delete using (user_id = auth.uid());

-- Permissões explícitas, como na 0005 --------------------------------------------------------
-- O Supabase dá todos os privilégios nas tabelas novas a anon e authenticated (default privileges).
-- Aqui eles são retirados antes. Sugestões novas só entram pelo servidor (chave de serviço).

revoke all on captura_djen, comunicacoes_djen from anon, authenticated;
grant select on captura_djen to authenticated;
grant insert (user_id, ligada, numero_oab, uf_oab, aviso_aceito_em) on captura_djen to authenticated;
grant update (ligada, numero_oab, uf_oab, aviso_aceito_em)          on captura_djen to authenticated;
grant select, delete on comunicacoes_djen to authenticated;
grant update (status) on comunicacoes_djen to authenticated;
grant all on captura_djen, comunicacoes_djen to service_role;

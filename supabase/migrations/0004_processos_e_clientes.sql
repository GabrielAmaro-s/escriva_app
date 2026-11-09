-- myPlan jurídico, etapa 2: clientes, detalhes do processo e tipo de serviço do consultivo.
-- Tabelas novas em português. As tabelas existentes não mudam de nome.

-- Projetos: chave (id, user_id) para as tabelas novas garantirem o mesmo dono ------

alter table projects add constraint projects_id_user_unique unique (id, user_id);

-- Função utilitária para atualizado_em (a set_updated_at grava em updated_at) ------

create or replace function set_atualizado_em() returns trigger
language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

-- Clientes ---------------------------------------------------------------------
-- documento guarda só o CPF/CNPJ sem pontuação: 11 dígitos para CPF (pf); 14 caracteres para CNPJ (pj),
-- os 12 primeiros podendo ter letras maiúsculas (CNPJ alfanumérico, desde julho de 2026) e os 2 últimos dígitos.

create table clientes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome          text not null check (char_length(nome) between 1 and 120),
  tipo          text not null default 'pf' check (tipo in ('pf', 'pj')),
  documento     text check (
                  documento is null
                  or (tipo = 'pf' and documento ~ '^[0-9]{11}$')
                  or (tipo = 'pj' and documento ~ '^[0-9A-Z]{12}[0-9]{2}$')
                ),
  telefone      text check (char_length(telefone) <= 30),
  email         text check (char_length(email) <= 200),
  observacoes   text check (char_length(observacoes) <= 2000),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (id, user_id)
);

create index clientes_usuario_nome_idx on clientes (user_id, nome);
-- O mesmo CPF/CNPJ não se repete na conta.
create unique index clientes_usuario_documento_idx on clientes (user_id, documento) where documento is not null;
create trigger clientes_atualizado_em before update on clientes
  for each row execute function set_atualizado_em();

-- Cliente do processo ou do caso consultivo (nulo permitido) ----------------------
-- A chave composta impede apontar para cliente de outra conta.
-- Ao excluir o cliente, só cliente_id volta a nulo (o user_id do projeto fica).

alter table projects add column cliente_id uuid;
alter table projects add constraint projects_cliente_fk
  foreign key (cliente_id, user_id) references clientes (id, user_id)
  on delete set null (cliente_id);

create index projects_cliente_idx on projects (cliente_id) where cliente_id is not null;

-- Detalhes do processo (1:1 com projects quando kind = 'project') -------------------
-- numero_cnj guarda só os 20 dígitos (NNNNNNN-DD.AAAA.J.TR.OOOO sem pontuação).

create table processo_detalhes (
  project_id      uuid primary key,
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  numero_cnj      text check (numero_cnj ~ '^[0-9]{20}$'),
  tribunal        text check (char_length(tribunal) <= 40),
  orgao           text check (char_length(orgao) <= 120),
  area            text check (area in ('civel', 'consumidor', 'trabalhista', 'previdenciario', 'familia', 'criminal', 'tributario', 'administrativo', 'outra')),
  fase            text check (fase in ('administrativa', 'inicial', 'instrucao', 'sentenca', 'recurso', 'execucao')),
  polo            text check (polo in ('autor', 'reu', 'terceiro')),
  parte_contraria text check (char_length(parte_contraria) <= 200),
  valor_causa     numeric(14, 2) check (valor_causa >= 0),
  segredo_justica boolean not null default false,
  link_autos      text check (char_length(link_autos) <= 2000),
  constraint processo_detalhes_projeto_fk
    foreign key (project_id, user_id) references projects (id, user_id) on delete cascade
);

-- O mesmo número CNJ não se repete na conta (o agente localiza o processo por ele).
create unique index processo_detalhes_usuario_cnj_idx on processo_detalhes (user_id, numero_cnj) where numero_cnj is not null;
create index processo_detalhes_usuario_area_idx on processo_detalhes (user_id, area);

-- Consultivo: tipo de serviço em texto único ----------------------------------------
-- channels continua existindo, com os dados como estão; a tela deixa de usá-lo.

alter table campaign_details add column tipo_servico text check (char_length(tipo_servico) <= 80);

update campaign_details
   set tipo_servico = nullif(btrim(channels[1]), '')
 where (tipo_servico is null or btrim(tipo_servico) = '')
   and cardinality(channels) > 0;

-- Row Level Security, no mesmo padrão das tabelas atuais -------------------------

alter table clientes          enable row level security;
alter table processo_detalhes enable row level security;

create policy "own clientes"  on clientes          for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own processos" on processo_detalhes for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Permissões explícitas, como na 0003 ---------------------------------------------

grant select, insert, update, delete on clientes, processo_detalhes to authenticated;
grant all on clientes, processo_detalhes to service_role;

-- myPlan: ajustes para o novo design
-- Ícone e prazo do projeto, e a paleta de tons (violet, blue, green, amber, red, pink, gray).

alter table projects add column if not exists icon text not null default 'folder';
alter table projects add column if not exists due_on date;

alter table projects alter column color set default 'violet';
alter table labels   alter column color set default 'gray';

-- Converte as cores da primeira versão para os tons novos.
update projects set color = case color
  when 'petroleo' then 'blue'
  when 'salvia'   then 'green'
  when 'ceu'      then 'blue'
  when 'lavanda'  then 'violet'
  when 'ameixa'   then 'pink'
  when 'rosa'     then 'red'
  when 'areia'    then 'amber'
  when 'grafite'  then 'violet'
  else color end;

update labels set color = case color
  when 'petroleo' then 'blue'
  when 'salvia'   then 'green'
  when 'ceu'      then 'blue'
  when 'lavanda'  then 'violet'
  when 'ameixa'   then 'pink'
  when 'rosa'     then 'red'
  when 'areia'    then 'amber'
  when 'grafite'  then 'gray'
  else color end;

update projects set icon = 'megaphone' where kind = 'campaign' and icon = 'folder';

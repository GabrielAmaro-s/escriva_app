# myPlan: arquitetura

Gerenciador pessoal de projetos e campanhas. Um quadro Kanban por projeto, pensado para uma pessoa só.

## 1. Proposta de arquitetura

Quatro camadas, cada uma só conversa com a de baixo:

```
Interface (app/ + components/)      páginas, componentes visuais, drag and drop
        │
Estado da tela (hooks/)             useProjects, useBoard: atualização otimista e desfazer
        │
Casos de uso (services/)            criar projeto, adicionar tarefa... validam e aplicam regras
        │
Regras de domínio (domain/)         tipos, progresso, posições, regra "Concluído = concluída"
        │
Acesso a dados (data/)              interface Repository
        ├── supabase/               Postgres + RLS + autenticação por link mágico
        └── local/                  localStorage, para testar sem backend
```

Decisões principais:

- **Next.js App Router, telas como Client Components.** O app é altamente interativo (arrastar, editar no lugar), então os dados são lidos e gravados no navegador com o cliente do Supabase, protegidos por Row Level Security. O servidor só cuida da sessão (`src/proxy.ts`) e do retorno do login (`/auth/callback`).
- **Repositório como contrato.** `data/repository.ts` define todas as operações. Existem duas implementações: Supabase e local. Sem as variáveis de ambiente o app roda sozinho no navegador, com dados de exemplo.
- **Atualização otimista.** Toda ação aparece na hora; se a gravação falhar, a tela volta ao estado anterior e um aviso explica o erro. Edições em sequência numa tarefa (digitar no checklist) são agrupadas numa única gravação.
- **Posições fracionárias.** Mover um cartão grava só aquele cartão, com a posição no meio dos vizinhos.
- **Drag and drop com dnd-kit.** Funciona com mouse, toque (pressionar e segurar) e teclado (Espaço para pegar, setas para mover).
- **Preparado para IA.** Um agente futuro (OpenBot ou outro) chama as mesmas funções de `services/` e o mesmo `Repository`. Nada da regra de negócio fica preso aos componentes. Quando chegar a hora, basta expor `services/` por Route Handlers ou Server Actions com a sessão do usuário.

## 2. Páginas e componentes

| Rota | Tela |
|---|---|
| `/` | Meus projetos (filtros Ativos, Pausados, Concluídos, Todos) |
| `/?filtro=arquivados` | Projetos arquivados |
| `/projetos/[id]` | Quadro Kanban do projeto |
| `/login` | Entrada por link mágico (só com Supabase) |

```
src/components/
├── layout/      app-shell (menu lateral + gaveta no celular), sidebar, theme-toggle
├── projects/    projects-view, project-card, project-form-dialog (projeto ou campanha)
├── board/       board-view, board (DndContext), board-column, task-card,
│                task-sheet (painel da tarefa), label-picker, links-editor, campaign-strip
└── ui/          button, field, modal (dialog nativo), menu, segmented, color-picker,
                 chip-input, check-list, confirm-dialog, toast
```

A tarefa abre num painel lateral (folha inferior no celular), sem trocar de página. Tudo é salvo ao sair do campo ou ao clicar, sem botão "Salvar".

## 3. Modelo de dados

Arquivo completo: `supabase/migrations/0001_init.sql`.

```
projects            id, user_id, name, description, kind (project|campaign),
                    status (active|paused|done), color, position, archived_at
campaign_details    project_id (1:1), objective, starts_on, ends_on,
                    channels text[], deliverables jsonb [{id,title,done}]
board_columns       id, project_id, title, kind (todo|doing|waiting|done), position
labels              id, project_id, name, color
tasks               id, project_id, column_id, title, description, due_on,
                    priority (low|medium|high|urgent), label_ids uuid[],
                    checklist jsonb [{id,text,done}], links jsonb [{id,url,title}],
                    completed, completed_at, position
project_task_counts (view) project_id, task_count, done_count
```

Escolhas:

- **Colunas são linhas no banco**, não um enum fixo. Hoje todo projeto nasce com as quatro colunas, mas renomear ou criar colunas no futuro não exige migração. O campo `kind` diz o papel de cada coluna.
- **Checklist, links e entregas em `jsonb`.** São listas pequenas que sempre se leem junto com a tarefa. Evita três tabelas e várias consultas por cartão.
- **Etiquetas por projeto**, aplicadas via `label_ids`. Excluir uma etiqueta remove ela das tarefas na tela; ids órfãos são ignorados na leitura.
- **Progresso** = tarefas concluídas / total, calculado pela view.
- **RLS em todas as tabelas**: cada linha tem `user_id` preenchido com `auth.uid()` e só o dono lê ou escreve.

## 4. Etapas de desenvolvimento

1. **Base (feito).** Next.js, Tailwind 4, tema claro/escuro, menu lateral, camada de dados com Supabase e modo local, schema SQL.
2. **Meus projetos (feito).** Cartões com cor, tipo, status e progresso; criar, editar, arquivar, restaurar, excluir; filtros; campos de campanha.
3. **Quadro Kanban (feito).** Quatro colunas, arrastar entre e dentro das colunas, criação rápida, painel da tarefa com data, prioridade, etiquetas, checklist, links e conclusão.
4. **Polimento.** Reordenar projetos na página inicial, busca rápida (Ctrl+K), atalhos de teclado no quadro, estados vazios por coluna.
5. **Dados confiáveis.** Testes das regras de `domain/`, migração do modo local para a conta Supabase, exportar em JSON.
6. **Integração com IA (futuro).** Expor `services/` como ferramentas para um agente: criar tarefas por linguagem natural, sugerir prioridades, gerar resumo do projeto.

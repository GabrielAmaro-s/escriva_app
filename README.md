# myPlan

Gerenciador pessoal de projetos e campanhas, com um quadro Kanban por projeto.

## Rodar

```bash
npm install
npm run dev
```

Abra http://localhost:3000. Sem configuração nenhuma o app roda em **modo local**: os dados ficam no navegador e já vêm alguns projetos de exemplo.

## Conectar ao Supabase

1. Crie um projeto em supabase.com.
2. No SQL Editor, rode `supabase/migrations/0001_init.sql` e depois `0002_design_myplan.sql`.
3. Em Authentication > URL Configuration, adicione `http://localhost:3000/auth/callback` (e a URL de produção) em Redirect URLs.
4. Copie `.env.example` para `.env.local` e preencha a URL e a chave anon (Project Settings > API).
5. Reinicie o `npm run dev`. O app passa a pedir login por link mágico no e-mail.

Os dados do modo local não são enviados ao Supabase automaticamente.

## Estrutura

```
src/
├── app/          rotas (Meus projetos, quadro, login)
├── components/   interface (layout, projects, board, ui)
├── hooks/        estado da tela com atualização otimista
├── services/     casos de uso (ponto de entrada para futuros agentes de IA)
├── domain/       tipos e regras de negócio puras
└── data/         repositório: Supabase ou local
supabase/         schema SQL com RLS
docs/             arquitetura, modelo de dados e etapas
```

Detalhes em `docs/ARQUITETURA.md`.

## Atalhos no quadro

- Enter em um cartão abre a tarefa.
- Espaço pega o cartão; setas movem; Espaço solta; Esc cancela.
- No celular, pressione e segure para arrastar.

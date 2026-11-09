# Regras de trabalho

Este repositório é o myPlan, em adaptação para advogados autônomos. O trabalho segue as etapas da seção 10 de `docs/PROPOSTA_JURIDICA.md`.

## Antes de começar uma etapa

- Ler `docs/PROPOSTA_JURIDICA.md` e `docs/ARQUITETURA.md` inteiros.
- Mostrar um plano curto, com os arquivos que vão mudar, e esperar a aprovação antes de editar.

## Git

- Uma branch por etapa: `juridico/etapa-N`.
- Commits pequenos, com mensagem clara em português.
- Nada de push sem pedido explícito.

## Banco

- Antes de qualquer migração, mostrar o SQL completo (tabelas, colunas, índices, RLS e grants) para revisão.
- Nenhuma migração é aplicada em banco nenhum sem confirmação.
- Se uma mudança fora do combinado parecer exigir migração, parar e perguntar.

## Código

- Nomes em português. Os campos antigos das entidades (`title`, `dueOn`, `projectId`...) e as tabelas e colunas que já existiam ficam como estão.
- Camadas respeitadas: regra em `domain/`, caso de uso em `services/`. A interface, a API e o agente chamam as mesmas funções.
- O nome do produto ainda não foi definido. Não renomear o projeto, o `package.json` nem textos de marca.
- Não mudar o comportamento do agente além do que a etapa pede.

## Textos

- Sem travessão (—). Usar ponto, vírgula ou conectivos.

## Pronto

- `npm run verificar` (typecheck, testes e build) passando.
- Relatório da etapa escrito e commitado na branch da etapa (ver abaixo).

## Relatório da etapa

Arquivo `docs/relatorios/etapa-N.md`, commitado na branch da etapa antes do merge, com estas seções:

1. **Resumo:** duas ou três frases sobre o que a etapa entrega.
2. **O que mudou:** por camada (domain, services, data, hooks, interface, agente/MCP, banco, docs), citando os arquivos principais.
3. **Decisões tomadas:** cada decisão com o motivo e as alternativas descartadas, incluindo as respondidas durante a etapa.
4. **Mudanças de comportamento:** o que um usuário ou o agente vai perceber de diferente.
5. **Banco:** migrações, tabelas e colunas novas, RLS e grants (ou "sem mudanças").
6. **Testes:** quantidade antes e depois, o que os testes novos cobrem e o resultado do `npm run verificar`.
7. **Como conferir à mão:** passos curtos para testar no navegador e no agente.
8. **Fora do escopo e pendências:** o que ficou para depois e em qual etapa.
9. **Riscos e dúvidas para a próxima etapa.**
10. **Commits:** lista com hash curto e mensagem.

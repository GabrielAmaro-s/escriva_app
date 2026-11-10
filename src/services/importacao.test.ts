import { describe, expect, it } from "vitest";
import { criarDadosDeExemplo } from "@/data/local/exemplo";
import { armazenamentoVazio, criarRepositorioLocal } from "@/data/local/repositorio-local";
import type { Repositorio } from "@/data/repositorio";
import { montarContagem } from "@/domain/prazos";
import { dadosProjetoVazios } from "@/domain/projeto";
import { descreverResumo, exportarDados, importarDados, lerArquivoExportado } from "./importacao";

/** Fotografia de um quadro sem ids, para comparar origem e destino. */
async function fotografar(repo: Repositorio, nome: string) {
  const projeto = (await repo.listarProjetos()).find((p) => p.name === nome)!;
  const quadro = (await repo.obterQuadro(projeto.id))!;
  const tituloDaColuna = new Map(quadro.colunas.map((c) => [c.id, c.title]));
  const nomeDaEtiqueta = new Map(quadro.etiquetas.map((e) => [e.id, `${e.name}:${e.color}`]));
  const cliente = (await repo.listarClientes()).find((c) => c.id === projeto.clienteId);
  return {
    cliente: cliente && { nome: cliente.nome, tipo: cliente.tipo, documento: cliente.documento, observacoes: cliente.observacoes },
    processo: projeto.processo,
    projeto: {
      name: projeto.name,
      description: projeto.description,
      kind: projeto.kind,
      status: projeto.status,
      color: projeto.color,
      icon: projeto.icon,
      dueOn: projeto.dueOn,
      campaign: projeto.campaign && { ...projeto.campaign, deliverables: projeto.campaign.deliverables.map(({ title, done }) => ({ title, done })) },
      taskCount: projeto.taskCount,
      doneCount: projeto.doneCount,
    },
    colunas: [...quadro.colunas].sort((a, b) => a.position - b.position).map(({ title, kind, position }) => ({ title, kind, position })),
    etiquetas: quadro.etiquetas.map((e) => `${e.name}:${e.color}`).sort(),
    tarefas: [...quadro.tarefas]
      .sort((a, b) => (tituloDaColuna.get(a.columnId)! + a.position).localeCompare(tituloDaColuna.get(b.columnId)! + b.position))
      .map((t) => ({
        coluna: tituloDaColuna.get(t.columnId),
        title: t.title,
        description: t.description,
        dueOn: t.dueOn,
        priority: t.priority,
        position: t.position,
        etiquetas: t.labelIds.map((id) => nomeDaEtiqueta.get(id)).sort(),
        checklist: t.checklist.map(({ text, done }) => ({ text, done })),
        links: t.links.map(({ url, title }) => ({ url, title })),
        completed: t.completed,
        completedAt: t.completedAt,
      })),
  };
}

describe("exportar e importar", () => {
  const exemplo = () => criarRepositorioLocal({ dados: criarDadosDeExemplo(new Date(2026, 10, 4)) });

  it("a importação reproduz o quadro 'Cobrança de aluguéis' igual ao exemplo", async () => {
    const origem = exemplo();
    const destino = criarRepositorioLocal({ dados: armazenamentoVazio() });

    const arquivo = JSON.parse(JSON.stringify(await exportarDados(origem)));
    const resumo = await importarDados(destino, arquivo);

    expect(await fotografar(destino, "Cobrança de aluguéis")).toEqual(await fotografar(origem, "Cobrança de aluguéis"));
    expect(resumo).toEqual({ clientes: 6, projetos: 7, campanhas: 3, colunas: 28, etiquetas: expect.any(Number), tarefas: 47 });
    expect((await fotografar(destino, "Cobrança de aluguéis")).cliente?.nome).toBe("Imobiliária Exemplo Ltda");
    expect((await fotografar(destino, "Cobrança de aluguéis")).processo).toMatchObject({ area: "civel", valorCausa: 18500 });
  });

  it("preserva a ordem dos projetos, campanhas e arquivados", async () => {
    const origem = exemplo();
    const [primeiro] = await origem.listarProjetos();
    await origem.atualizarProjeto(primeiro.id, { archivedAt: "2026-11-01T00:00:00.000Z" });

    const destino = criarRepositorioLocal({ dados: armazenamentoVazio() });
    await importarDados(destino, await exportarDados(origem));

    const nomes = async (r: Repositorio) => (await r.listarProjetos()).map((p) => `${p.name}|${p.archivedAt ?? ""}`);
    expect(await nomes(destino)).toEqual(await nomes(origem));
    expect(await fotografar(destino, "Contrato de prestação de serviços")).toEqual(await fotografar(origem, "Contrato de prestação de serviços"));
  });

  it("recusa arquivo inválido sem gravar nada", async () => {
    const destino = criarRepositorioLocal({ dados: armazenamentoVazio() });
    await expect(importarDados(destino, { versao: 2 })).rejects.toThrow(/Arquivo inválido/);
    expect(await destino.listarProjetos()).toEqual([]);
    expect(() => lerArquivoExportado("texto")).toThrow(/Arquivo inválido/);
  });

  it("descreve quantos itens foram importados", () => {
    expect(descreverResumo({ clientes: 1, projetos: 2, campanhas: 1, colunas: 8, etiquetas: 1, tarefas: 5 })).toBe(
      "Importados: 1 cliente, 2 processos, 1 caso consultivo, 5 tarefas, 1 etiqueta, 8 colunas.",
    );
  });

  it("aceita arquivo exportado antes da etapa 2 (sem clientes nem detalhes do processo)", async () => {
    const arquivo = JSON.parse(JSON.stringify(await exportarDados(exemplo())));
    delete arquivo.clientes;
    delete arquivo.processos;
    for (const p of arquivo.projetos) delete p.clienteId;
    for (const c of arquivo.campanhas) delete c.tipoServico;
    const destino = criarRepositorioLocal({ dados: armazenamentoVazio() });
    const resumo = await importarDados(destino, arquivo);
    expect(resumo.clientes).toBe(0);
    const consultivo = (await destino.listarProjetos()).find((p) => p.name === "Parecer sobre LGPD")!;
    // Sem tipo de serviço no arquivo, vale o primeiro canal (como na migração 0004).
    expect(consultivo.campaign?.tipoServico).toBe("Parecer");
  });

  it("reaproveita o cliente que já existe na conta com o mesmo CPF/CNPJ", async () => {
    const origem = criarRepositorioLocal({ dados: armazenamentoVazio() });
    const c = await origem.criarCliente({ nome: "Cliente", tipo: "pj", documento: "11222333000181", telefone: null, email: null, observacoes: null });
    await origem.criarProjeto({ ...dadosProjetoVazios(), name: "Processo", clienteId: c.id }, [{ title: "A fazer", kind: "todo" }]);

    const destino = criarRepositorioLocal({ dados: armazenamentoVazio() });
    const jaExiste = await destino.criarCliente({ nome: "Mesmo cliente", tipo: "pj", documento: "11222333000181", telefone: null, email: null, observacoes: null });
    const resumo = await importarDados(destino, await exportarDados(origem));
    expect(resumo.clientes).toBe(0);
    expect((await destino.listarProjetos())[0].clienteId).toBe(jaExiste.id);
  });
});

describe("exportar e importar: prazos (etapa 3)", () => {
  it("leva tipo, prazo fatal, contagem, audiência, documento do cliente e feriados locais", async () => {
    const origem = criarRepositorioLocal({ dados: armazenamentoVazio() });
    const p = await origem.criarProjeto({ ...dadosProjetoVazios(), name: "Processo" }, [{ title: "A fazer", kind: "todo" }]);
    const coluna = (await origem.obterQuadro(p.id))!.colunas[0].id;
    const { contagem, prazoInterno } = montarContagem({ inicio: "2026-11-09", meio: "dje", dias: 15, regra: "civel", margem: 2 }, [], "TJRS");
    const prazo = await origem.criarTarefa({ projectId: p.id, columnId: coluna, title: "Contestação", tipo: "prazo", prazoFatal: contagem.vencimento, contagem, dueOn: prazoInterno });
    await origem.atualizarTarefa(prazo.id, { checklist: [{ id: "i1", text: "Procuração", done: false, doCliente: true }] });
    await origem.criarTarefa({ projectId: p.id, columnId: coluna, title: "Audiência", tipo: "audiencia", horarioAudiencia: "2026-12-03T17:00:00.000Z", localAudiencia: "Sala 3" });
    await origem.criarFeriado({ data: "2026-02-02", descricao: "Navegantes", tipo: "feriado" });

    const destino = criarRepositorioLocal({ dados: armazenamentoVazio() });
    await importarDados(destino, JSON.parse(JSON.stringify(await exportarDados(origem))));
    // De novo: o feriado repetido é ignorado, sem erro.
    await importarDados(destino, JSON.parse(JSON.stringify(await exportarDados(origem))));

    const tarefas = (await destino.obterEspacoDeTrabalho()).tarefas;
    expect(tarefas.find((t) => t.title === "Contestação")).toMatchObject({
      tipo: "prazo",
      prazoFatal: "2026-12-02",
      dueOn: "2026-11-30",
      contagem: { vencimento: "2026-12-02", memoria: contagem.memoria },
      checklist: [{ text: "Procuração", doCliente: true }],
    });
    expect(tarefas.find((t) => t.title === "Audiência")).toMatchObject({ tipo: "audiencia", horarioAudiencia: "2026-12-03T17:00:00.000Z", localAudiencia: "Sala 3" });
    expect((await destino.listarFeriados()).filter((f) => f.userId !== null).map((f) => [f.data, f.descricao])).toEqual([["2026-02-02", "Navegantes"]]);
  });

  it("arquivo sem os campos novos vira providência", async () => {
    const origem = criarRepositorioLocal({ dados: armazenamentoVazio() });
    const p = await origem.criarProjeto({ ...dadosProjetoVazios(), name: "Antigo" }, [{ title: "A fazer", kind: "todo" }]);
    await origem.criarTarefa({ projectId: p.id, columnId: (await origem.obterQuadro(p.id))!.colunas[0].id, title: "T" });
    const arquivo = JSON.parse(JSON.stringify(await exportarDados(origem)));
    delete arquivo.feriados;
    for (const t of arquivo.tarefas) for (const c of ["tipo", "prazoFatal", "contagem", "localAudiencia", "horarioAudiencia"]) delete t[c];
    const destino = criarRepositorioLocal({ dados: armazenamentoVazio() });
    await importarDados(destino, arquivo);
    expect((await destino.obterEspacoDeTrabalho()).tarefas[0]).toMatchObject({ tipo: "providencia", prazoFatal: null, contagem: null });
  });
});

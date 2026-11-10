"use client";

import { ArrowSquareOutIcon, CopyIcon, DotsThreeIcon, FlagIcon, IdentificationCardIcon, LinkIcon, PlusIcon, TrashIcon, XIcon } from "@phosphor-icons/react";
import { useEffect, useState, type ReactNode } from "react";
import { Marcador, Pilula } from "@/components/ui/pecas";
import { BotaoIcone } from "@/components/ui/botao";
import { useMenuDeContexto } from "@/components/ui/menu-contexto";
import { Selecao, classeControle } from "@/components/ui/campo";
import { Janela } from "@/components/ui/janela";
import { COR_MARCADOR_COLUNA, COR_PRIORIDADE, PRIORIDADES, ROTULO_PRIORIDADE, alteracaoAoMudarColuna, novoId, proximaPosicaoNaColuna } from "@/domain/quadro";
import type { LinkTarefa, PrioridadeTarefa, Projeto } from "@/domain/tipos";
import { useLembretes } from "@/hooks/use-lembretes";
import { usePrazos } from "@/hooks/use-prazos";
import type { ApiTarefas } from "@/hooks/use-tarefas";
import { useUsuarioAtual } from "@/hooks/use-usuario-atual";
import { paraCampoDataHora } from "@/domain/datas";
import { classes } from "@/lib/classes";
import { CamposDoTipo, ContagemDoPrazo, HistoricoDoPrazo } from "./secao-prazo";

const NOVA_ETIQUETA = "__nova__";

function Secao({ titulo, children }: { titulo: ReactNode; children: ReactNode }) {
  return (
    <div>
      <p className="mb-[7px] text-xs font-semibold">{titulo}</p>
      {children}
    </div>
  );
}

/** Aceita "site.com/pagina" ou "https://..."; qualquer outro texto vira só um título. */
function interpretarLink(bruto: string): LinkTarefa | null {
  const v = bruto.trim();
  if (!v) return null;
  const pareceUrl = /^https?:\/\//i.test(v) || /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(v);
  if (pareceUrl) {
    try {
      const url = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
      return { id: novoId(), url: url.toString(), title: null };
    } catch {
      // segue como título
    }
  }
  return { id: novoId(), url: "", title: v };
}

const textoDoLink = (l: LinkTarefa) => {
  if (l.title) return l.title;
  try {
    const u = new URL(l.url);
    return u.hostname.replace(/^www\./, "") + (u.pathname !== "/" ? u.pathname : "");
  } catch {
    return l.url;
  }
};

export function JanelaTarefa({
  api,
  tarefaId,
  projetos,
  aoFechar,
}: {
  api: ApiTarefas;
  tarefaId: string | null;
  projetos: Projeto[];
  aoFechar: () => void;
}) {
  const tarefa = api.tarefas.find((t) => t.id === tarefaId) ?? null;
  const abrirMenu = useMenuDeContexto();
  const usuario = useUsuarioAtual();
  const lembretes = useLembretes();
  const prazos = usePrazos();
  const [lembrete, setLembrete] = useState("");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [novoItem, setNovoItem] = useState("");
  const [novoLink, setNovoLink] = useState("");
  const [criandoEtiqueta, setCriandoEtiqueta] = useState(false);
  const [nomeEtiqueta, setNomeEtiqueta] = useState("");

  useEffect(() => {
    setTitulo(tarefa?.title ?? "");
    setDescricao(tarefa?.description ?? "");
    setNovoItem("");
    setNovoLink("");
    setCriandoEtiqueta(false);
    // só ao trocar de tarefa, para não sobrescrever o que está sendo digitado
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tarefa?.id]);

  // O campo de lembrete acompanha o lembrete salvo (também quando ele carrega depois da janela abrir).
  const quandoSalvo = tarefa ? lembretes.lembreteDaTarefa(tarefa.id)?.quando : undefined;
  useEffect(() => {
    setLembrete(quandoSalvo ? paraCampoDataHora(quandoSalvo) : "");
  }, [tarefa?.id, quandoSalvo]);

  if (!tarefa) return null;

  const projeto = projetos.find((p) => p.id === tarefa.projectId);
  const colunas = api.colunasDe(tarefa.projectId);
  const coluna = colunas.find((c) => c.id === tarefa.columnId);
  const etiquetasDoProjeto = api.etiquetasDe(tarefa.projectId);
  const aplicadas = tarefa.labelIds.map((id) => api.etiquetasPorId.get(id)).filter((l) => l !== undefined);
  const disponiveis = etiquetasDoProjeto.filter((l) => !tarefa.labelIds.includes(l.id));
  const itensFeitos = tarefa.checklist.filter((i) => i.done).length;
  const alterar = (alteracao: Parameters<typeof api.atualizarTarefa>[1]) => api.atualizarTarefa(tarefa.id, alteracao);

  const confirmarTitulo = () => {
    const limpo = titulo.trim().slice(0, 200);
    if (!limpo) return setTitulo(tarefa.title);
    if (limpo !== tarefa.title) api.atualizarTarefa(tarefa.id, { title: limpo });
  };
  const confirmarDescricao = () => {
    const limpo = descricao.trim() || null;
    if (limpo !== tarefa.description) api.atualizarTarefa(tarefa.id, { description: limpo });
  };
  const lembreteAtual = lembretes.lembreteDaTarefa(tarefa.id);
  const confirmarLembrete = () => {
    const anterior = lembreteAtual ? paraCampoDataHora(lembreteAtual.quando) : "";
    if (lembrete === anterior) return;
    // O campo datetime-local vem no fuso do aparelho; o Date converte para UTC.
    lembretes.definirLembreteDaTarefa(tarefa, lembrete ? new Date(lembrete).toISOString() : null);
  };
  const fechar = () => {
    confirmarTitulo();
    confirmarDescricao();
    confirmarLembrete();
    aoFechar();
  };

  const adicionarItem = () => {
    const texto = novoItem.trim();
    if (!texto) return;
    api.atualizarTarefa(tarefa.id, { checklist: [...tarefa.checklist, { id: novoId(), text: texto, done: false }] });
    setNovoItem("");
  };
  const adicionarLink = () => {
    const link = interpretarLink(novoLink);
    if (!link) return;
    api.atualizarTarefa(tarefa.id, { links: [...tarefa.links, link] });
    setNovoLink("");
  };
  const criarEtiqueta = async () => {
    const etiqueta = await api.criarEtiqueta(tarefa.projectId, nomeEtiqueta);
    if (etiqueta && !tarefa.labelIds.includes(etiqueta.id)) api.atualizarTarefa(tarefa.id, { labelIds: [...tarefa.labelIds, etiqueta.id] });
    setNomeEtiqueta("");
    setCriandoEtiqueta(false);
  };

  const menu = (e: React.MouseEvent) =>
    abrirMenu(e, [
      { rotulo: "Duplicar", icone: CopyIcon, aoSelecionar: () => api.duplicarTarefa(tarefa.id) },
      {
        rotulo: "Excluir",
        icone: TrashIcon,
        perigo: true,
        aoSelecionar: () => {
          aoFechar();
          api.excluirTarefa(tarefa.id);
        },
      },
    ]);

  return (
    <Janela aberta aoFechar={fechar} rotulo={tarefa.title} className="max-w-[780px]">
      <div className="flex items-center gap-2.5 pl-[22px] pr-[18px] pt-3.5">
        <button
          type="button"
          onClick={() => api.alternarConclusao(tarefa.id)}
          aria-pressed={tarefa.completed}
          aria-label={tarefa.completed ? "Reabrir tarefa" : "Concluir tarefa"}
          title={tarefa.completed ? "Reabrir" : "Concluir"}
          className="border-0 bg-transparent p-0"
        >
          <Marcador marcado={tarefa.completed} cor="green" tamanho={18} />
        </button>
        {projeto && (
          <span data-tone={projeto.color} className="flex items-center gap-[7px] text-[12.5px] text-ink-muted">
            <span className="size-2 rounded-full bg-tone" aria-hidden />
            {projeto.name}
          </span>
        )}
        <span className="ml-auto flex gap-0.5">
          <BotaoIcone rotulo="Mais opções" onClick={menu}>
            <DotsThreeIcon size={16} weight="bold" />
          </BotaoIcone>
          <BotaoIcone rotulo="Fechar" onClick={fechar}>
            <XIcon size={17} weight="bold" />
          </BotaoIcone>
        </span>
      </div>

      <div className="px-[22px] pt-1.5">
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          onBlur={confirmarTitulo}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          placeholder="Título da tarefa"
          aria-label="Título da tarefa"
          className={classes(
            "-mx-2 w-[calc(100%+16px)] rounded-[9px] border border-transparent bg-transparent px-2 py-1.5 text-[22px] font-bold tracking-[-0.02em] text-ink outline-none hover:bg-hover focus:border-primary focus:bg-surface-raised",
            tarefa.completed && "text-ink-muted",
          )}
        />
      </div>

      <div className="flex flex-wrap gap-x-7 gap-y-6 px-[22px] pb-[22px] pt-4">
        <div className="flex min-w-0 flex-[2_1_340px] flex-col gap-[22px]">
          {tarefa.tipo === "prazo" && (
            <ContagemDoPrazo
              key={tarefa.id}
              tarefa={tarefa}
              projeto={projeto}
              feriados={prazos.feriados}
              margemPadrao={prazos.margemPadrao}
              alterar={alterar}
            />
          )}

          <Secao titulo="Descrição">
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              onBlur={confirmarDescricao}
              rows={3}
              placeholder="Adicione detalhes, contexto ou critérios de pronto…"
              className={classes(classeControle, "resize-y py-2.5 leading-normal")}
            />
          </Secao>

          <Secao titulo={`Checklist${tarefa.checklist.length ? ` (${itensFeitos}/${tarefa.checklist.length})` : ""}`}>
            {tarefa.checklist.length > 0 && (
              <div className="mb-2 h-1 overflow-hidden rounded bg-line">
                <div className="h-full rounded bg-primary transition-[width] duration-300" style={{ width: `${(itensFeitos / tarefa.checklist.length) * 100}%` }} />
              </div>
            )}
            <ul className="flex flex-col">
              {tarefa.checklist.map((item) => (
                <li key={item.id} className="flex min-h-[34px] items-center gap-2.5 rounded-lg px-1">
                  <button
                    type="button"
                    aria-pressed={item.done}
                    aria-label={item.done ? `Desmarcar ${item.text}` : `Marcar ${item.text}`}
                    onClick={() => api.atualizarTarefa(tarefa.id, { checklist: tarefa.checklist.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)) })}
                    className="border-0 bg-transparent p-0"
                  >
                    <Marcador marcado={item.done} />
                  </button>
                  {item.doCliente && (
                    <span className="shrink-0 rounded-full bg-primary-soft px-1.5 text-[10.5px] font-semibold text-primary" title="Documento do cliente">
                      Cliente
                    </span>
                  )}
                  <input
                    value={item.text}
                    aria-label="Item do checklist"
                    onChange={(e) =>
                      api.atualizarTarefa(tarefa.id, { checklist: tarefa.checklist.map((i) => (i.id === item.id ? { ...i, text: e.target.value } : i)) })
                    }
                    onBlur={(e) => !e.target.value.trim() && api.atualizarTarefa(tarefa.id, { checklist: tarefa.checklist.filter((i) => i.id !== item.id) })}
                    className={classes("h-[30px] min-w-0 flex-1 border-0 bg-transparent text-[13.5px] outline-none", item.done ? "text-ink-muted line-through" : "text-ink")}
                  />
                  <BotaoIcone
                    rotulo={item.doCliente ? "Não é documento do cliente" : "Marcar como documento do cliente"}
                    aria-pressed={Boolean(item.doCliente)}
                    className={classes("size-[22px] rounded-md", item.doCliente ? "text-primary" : "text-ink-muted")}
                    onClick={() =>
                      api.atualizarTarefa(tarefa.id, { checklist: tarefa.checklist.map((i) => (i.id === item.id ? { ...i, doCliente: !i.doCliente } : i)) })
                    }
                  >
                    <IdentificationCardIcon size={14} />
                  </BotaoIcone>
                  <BotaoIcone
                    rotulo="Remover"
                    className="size-[22px] rounded-md text-ink-muted"
                    onClick={() => api.atualizarTarefa(tarefa.id, { checklist: tarefa.checklist.filter((i) => i.id !== item.id) })}
                  >
                    <XIcon size={13} weight="bold" />
                  </BotaoIcone>
                </li>
              ))}
            </ul>
            <div className="mt-0.5 flex items-center gap-2.5 px-1">
              <PlusIcon size={14} weight="bold" className="shrink-0 text-ink-muted" />
              <input
                value={novoItem}
                onChange={(e) => setNovoItem(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), adicionarItem())}
                onBlur={adicionarItem}
                placeholder="Adicionar subtarefa…"
                aria-label="Adicionar subtarefa"
                className="h-8 flex-1 border-0 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-ink-muted"
              />
            </div>
          </Secao>

          <Secao titulo="Links e referências">
            {tarefa.links.length > 0 && (
              <ul className="flex flex-col overflow-hidden rounded-[10px] border border-line">
                {tarefa.links.map((l) => (
                  <li key={l.id} className="flex h-[38px] items-center gap-2.5 border-b border-line pl-3 pr-1.5 text-[13px] last:border-b-0">
                    <LinkIcon size={14} className="shrink-0 text-ink-muted" />
                    {l.url ? (
                      <a
                        href={l.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="min-w-0 flex-1 truncate text-ink no-underline hover:text-primary hover:underline"
                      >
                        {textoDoLink(l)}
                      </a>
                    ) : (
                      <span className="min-w-0 flex-1 truncate">{textoDoLink(l)}</span>
                    )}
                    {l.url && (
                      <a href={l.url} target="_blank" rel="noreferrer noopener" aria-label="Abrir link" className="flex text-ink-muted hover:text-ink">
                        <ArrowSquareOutIcon size={13} />
                      </a>
                    )}
                    <BotaoIcone
                      rotulo="Remover link"
                      className="size-6 rounded-md text-ink-muted"
                      onClick={() => api.atualizarTarefa(tarefa.id, { links: tarefa.links.filter((x) => x.id !== l.id) })}
                    >
                      <XIcon size={13} weight="bold" />
                    </BotaoIcone>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-1 flex items-center gap-2.5 px-1">
              <PlusIcon size={14} weight="bold" className="shrink-0 text-primary" />
              <input
                value={novoLink}
                onChange={(e) => setNovoLink(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), adicionarLink())}
                placeholder="Adicionar link (título ou URL)…"
                aria-label="Adicionar link"
                className="h-8 flex-1 border-0 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-ink-muted"
              />
            </div>
          </Secao>
        </div>

        <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-4">
          <CamposDoTipo tarefa={tarefa} alterar={alterar} />

          <Secao titulo="Status">
            <Selecao
              aria-label="Status"
              value={tarefa.columnId}
              inicio={<span className="size-2 rounded-full" style={{ background: coluna ? COR_MARCADOR_COLUNA[coluna.kind] : undefined }} />}
              onChange={(e) => {
                const destino = colunas.find((c) => c.id === e.target.value);
                if (!destino) return;
                api.atualizarTarefa(tarefa.id, {
                  ...alteracaoAoMudarColuna(tarefa, destino),
                  position: proximaPosicaoNaColuna(
                    api.tarefas.filter((t) => t.id !== tarefa.id),
                    destino.id,
                  ),
                });
              }}
            >
              {colunas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </Selecao>
          </Secao>

          <Secao titulo="Prioridade">
            <Selecao
              aria-label="Prioridade"
              value={tarefa.priority}
              inicio={<FlagIcon size={13} weight="fill" style={{ color: COR_PRIORIDADE[tarefa.priority] }} />}
              onChange={(e) => api.atualizarTarefa(tarefa.id, { priority: e.target.value as PrioridadeTarefa })}
            >
              {PRIORIDADES.map((p) => (
                <option key={p} value={p}>
                  {ROTULO_PRIORIDADE[p]}
                </option>
              ))}
            </Selecao>
          </Secao>

          {tarefa.tipo === "providencia" && (
            <Secao titulo="Data de entrega">
              <input
                type="date"
                aria-label="Data de entrega"
                value={tarefa.dueOn ?? ""}
                onChange={(e) => api.atualizarTarefa(tarefa.id, { dueOn: e.target.value || null })}
                className={classes(classeControle, "h-9 rounded-[9px] px-2.5 text-[13px]")}
              />
            </Secao>
          )}

          <Secao titulo="Lembrete">
            <input
              type="datetime-local"
              aria-label="Lembrete"
              value={lembrete}
              onChange={(e) => setLembrete(e.target.value)}
              onBlur={confirmarLembrete}
              className={classes(classeControle, "h-9 rounded-[9px] px-2.5 text-[13px]")}
            />
          </Secao>

          <Secao titulo="Etiquetas">
            <div className="flex flex-wrap items-center gap-1.5">
              {aplicadas.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  title="Remover"
                  onClick={() => api.atualizarTarefa(tarefa.id, { labelIds: tarefa.labelIds.filter((x) => x !== l.id) })}
                  className="border-0 bg-transparent p-0"
                >
                  <Pilula tom={l.color} className="inline-flex h-6 items-center gap-[5px] px-2 text-xs">
                    {l.name}
                    <XIcon size={10} weight="bold" />
                  </Pilula>
                </button>
              ))}
              {criandoEtiqueta ? (
                <input
                  autoFocus
                  value={nomeEtiqueta}
                  onChange={(e) => setNomeEtiqueta(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      criarEtiqueta();
                    }
                    if (e.key === "Escape") {
                      e.stopPropagation();
                      e.nativeEvent.stopImmediatePropagation();
                      setCriandoEtiqueta(false);
                    }
                  }}
                  onBlur={() => (nomeEtiqueta.trim() ? criarEtiqueta() : setCriandoEtiqueta(false))}
                  maxLength={40}
                  placeholder="Nome da etiqueta"
                  aria-label="Nome da nova etiqueta"
                  className="h-6 w-32 rounded-full border border-primary bg-surface-raised px-2.5 text-xs text-ink outline-none"
                />
              ) : (
                <select
                  value=""
                  aria-label="Adicionar etiqueta"
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === NOVA_ETIQUETA) return setCriandoEtiqueta(true);
                    if (v) api.atualizarTarefa(tarefa.id, { labelIds: [...tarefa.labelIds, v] });
                  }}
                  className="h-6 w-[92px] cursor-pointer rounded-full border border-dashed border-line-forte bg-transparent px-1.5 text-xs text-ink-muted outline-none"
                >
                  <option value="">+ Etiqueta</option>
                  {disponiveis.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                  <option value={NOVA_ETIQUETA}>Criar etiqueta…</option>
                </select>
              )}
            </div>
          </Secao>

          {tarefa.tipo === "prazo" && (
            <Secao titulo="Histórico do prazo">
              <HistoricoDoPrazo key={tarefa.id} carregar={() => prazos.historicoDaTarefa(tarefa.id)} />
            </Secao>
          )}

          <Secao titulo="Responsável">
            <div className="flex h-9 items-center gap-[9px] rounded-[9px] border border-line-forte px-2.5 text-[13px]">
              <span className="grid size-[22px] place-items-center rounded-full bg-primary-soft text-[11px] font-semibold text-primary">{usuario.inicial}</span>
              {usuario.nome}
            </div>
          </Secao>
        </div>
      </div>
    </Janela>
  );
}

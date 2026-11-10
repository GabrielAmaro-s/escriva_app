"use client";

import { ArrowCounterClockwiseIcon, CopyIcon, KeyIcon } from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";
import { Botao } from "@/components/ui/botao";
import { useAviso } from "@/components/ui/aviso";
import { CampoTexto, Selecao } from "@/components/ui/campo";
import { Pilula } from "@/components/ui/pecas";
import { supabaseConfigurado } from "@/data/supabase/cliente";
import { formatarDataHora } from "@/domain/datas";
import { descreverMinutos, type SituacaoAgente } from "@/domain/lembrete";
import type { EscopoToken, RegistroAgente, TokenAgente } from "@/domain/tipos";
import { useLembretes } from "@/hooks/use-lembretes";
import { useProjetos } from "@/hooks/use-projetos";
import { chamarApi } from "@/lib/chamar-api";
import { classes } from "@/lib/classes";
import { LinhaConfiguracao } from "./linha-configuracao";

const mensagem = (e: unknown) => (e instanceof Error ? e.message : "Algo deu errado. Tente de novo.");

const NOME_DA_FERRAMENTA: Record<string, string> = {
  listar_projetos: "Consultou os processos e casos consultivos",
  ver_quadro: "Consultou um quadro",
  buscar_tarefas: "Buscou tarefas",
  resumir_projeto: "Resumiu um processo",
  lembretes_proximos: "Conferiu os lembretes",
  prazos_proximos: "Consultou os prazos",
  audiencias_proximas: "Consultou as audiências",
  criar_tarefas: "Criou tarefas",
  atualizar_tarefa: "Atualizou uma tarefa",
  mover_tarefa: "Moveu uma tarefa",
  adicionar_checklist: "Adicionou checklist",
  criar_lembrete: "Criou um lembrete",
  marcar_lembrete: "Marcou um lembrete",
  criar_projeto: "Criou um caso",
  criar_processo: "Criou um processo",
  sugerir_prioridades: "Mudou prioridades",
  concluir_em_lote: "Concluiu tarefas",
  excluir_tarefa: "Excluiu um item",
  registrar_intimacao: "Registrou uma intimação",
};

/** Conecta o agente pessoal: estado, tokens de acesso e o que ele fez. */
export function SecaoAgente() {
  const avisar = useAviso();
  const projetos = useProjetos();
  const lembretes = useLembretes();
  const [situacao, setSituacao] = useState<(SituacaoAgente & { limiteMin: number }) | null>(null);
  const [tokens, setTokens] = useState<TokenAgente[]>([]);
  const [registro, setRegistro] = useState<RegistroAgente[]>([]);
  const [nome, setNome] = useState("");
  const [escopo, setEscopo] = useState<EscopoToken>("escrita");
  const [gerando, setGerando] = useState(false);
  const [tokenNovo, setTokenNovo] = useState<string | null>(null);

  const carregar = useCallback(() => {
    chamarApi<SituacaoAgente & { limiteMin: number }>("/api/agente/estado").then(setSituacao).catch(() => setSituacao(null));
    chamarApi<TokenAgente[]>("/api/agente/tokens").then(setTokens).catch(() => setTokens([]));
    chamarApi<RegistroAgente[]>("/api/agente/registro").then(setRegistro).catch(() => setRegistro([]));
  }, []);

  useEffect(() => {
    if (supabaseConfigurado) carregar();
  }, [carregar]);

  if (!supabaseConfigurado) {
    return (
      <>
        <p className="mb-2.5 mt-7 text-xs font-semibold text-ink3">Agente</p>
        <p className="text-[12.5px] text-ink3">O agente pessoal precisa do Supabase: ele conversa com o servidor do myPlan, não com este navegador.</p>
      </>
    );
  }

  async function gerar() {
    setGerando(true);
    try {
      const { token, registro: novo } = await chamarApi<{ token: string; registro: TokenAgente }>("/api/agente/tokens", { metodo: "POST", corpo: { nome, escopo } });
      setTokenNovo(token);
      setTokens((lista) => [novo, ...lista]);
      setNome("");
    } catch (e) {
      avisar({ texto: mensagem(e), tom: "erro" });
    } finally {
      setGerando(false);
    }
  }

  async function copiar() {
    if (!tokenNovo) return;
    try {
      await navigator.clipboard.writeText(tokenNovo);
      avisar({ texto: "Token copiado", tom: "info" });
    } catch {
      avisar({ texto: "Não foi possível copiar. Selecione o texto e copie à mão.", tom: "erro" });
    }
  }

  async function revogar(token: TokenAgente) {
    try {
      await chamarApi<void>(`/api/agente/tokens/${token.id}`, { metodo: "DELETE" });
      setTokens((lista) => lista.map((t) => (t.id === token.id ? { ...t, revogadoEm: new Date().toISOString() } : t)));
      avisar({ texto: `Token “${token.nome}” revogado`, tom: "info" });
    } catch (e) {
      avisar({ texto: mensagem(e), tom: "erro" });
    }
  }

  async function desfazer(linha: RegistroAgente) {
    try {
      const { mensagem: texto } = await chamarApi<{ mensagem: string }>(`/api/agente/registro/${linha.id}/desfazer`, { metodo: "POST" });
      setRegistro((lista) => lista.map((r) => (r.id === linha.id ? { ...r, desfeitoEm: new Date().toISOString() } : r)));
      projetos.recarregar();
      lembretes.recarregar();
      avisar({ texto, tom: "info" });
    } catch (e) {
      avisar({ texto: mensagem(e), tom: "erro" });
    }
  }

  const estado =
    !situacao || situacao.situacao === "nunca"
      ? { tom: "gray" as const, texto: "Nunca conectado" }
      : situacao.situacao === "ativo"
        ? { tom: "green" as const, texto: "Ativo" }
        : { tom: "amber" as const, texto: `Sem sinal há ${descreverMinutos(situacao.minutosSemSinal ?? 0)}` };

  return (
    <>
      <p className="mb-2.5 mt-7 text-xs font-semibold text-ink3">Agente</p>
      <div className="rounded-[14px] border border-line bg-surface px-[18px]">
        <LinhaConfiguracao
          titulo="Estado do agente"
          dica={situacao?.ultimoSinalEm ? `Último sinal: ${formatarDataHora(situacao.ultimoSinalEm)}.` : "O agente avisa que está vivo cada vez que confere os lembretes."}
        >
          <Pilula tom={estado.tom} className="px-2.5 py-1 text-xs">
            {estado.texto}
          </Pilula>
        </LinhaConfiguracao>

        <div className="border-b border-line py-4 last:border-b-0">
          <p className="text-sm font-semibold">Gerar token</p>
          <p className="mt-0.5 text-[12.5px] text-ink2">O agente usa o token para acessar seus processos. Leitura só consulta; escrita também cria e altera.</p>
          <form
            className="mt-3 flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              gerar();
            }}
          >
            <CampoTexto value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome (ex.: nanobot da VPS)" aria-label="Nome do token" maxLength={60} className="h-9 min-w-[180px] flex-1 text-[13px]" />
            <div className="w-[130px]">
              <Selecao aria-label="Escopo" value={escopo} onChange={(e) => setEscopo(e.target.value as EscopoToken)}>
                <option value="escrita">Escrita</option>
                <option value="leitura">Leitura</option>
              </Selecao>
            </div>
            <Botao tamanho="sm" type="submit" disabled={gerando || !nome.trim()}>
              <KeyIcon size={15} />
              {gerando ? "Gerando…" : "Gerar token"}
            </Botao>
          </form>
          {tokenNovo && (
            <div className="mt-3 rounded-[10px] border border-primary-line bg-primary-soft p-3">
              <p className="text-[12.5px] font-semibold text-ink">Copie agora: este token não aparece de novo.</p>
              <div className="mt-2 flex items-center gap-2">
                <code className="min-w-0 flex-1 select-all break-all rounded-lg border border-line bg-surface px-2.5 py-2 font-mono text-xs text-ink">{tokenNovo}</code>
                <Botao tamanho="sm" onClick={copiar}>
                  <CopyIcon size={15} />
                  Copiar
                </Botao>
              </div>
            </div>
          )}
        </div>

        <div className="py-4">
          <p className="text-sm font-semibold">Tokens</p>
          {tokens.length === 0 ? (
            <p className="mt-0.5 text-[12.5px] text-ink2">Nenhum token ainda.</p>
          ) : (
            <ul className="mt-2 flex flex-col">
              {tokens.map((t) => {
                const expirado = new Date(t.expiraEm) < new Date();
                return (
                  <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line py-2.5 last:border-b-0">
                    <div className="min-w-0 flex-1">
                      <p className={classes("text-[13.5px] font-medium", (t.revogadoEm || expirado) && "text-ink3")}>
                        {t.nome} <span className="font-normal text-ink3">· {t.escopo === "leitura" ? "Leitura" : "Escrita"}</span>
                      </p>
                      <p className="text-xs text-ink3">
                        {t.ultimoUsoEm ? `Último uso: ${formatarDataHora(t.ultimoUsoEm)}` : "Nunca usado"} · {expirado ? "Expirou" : `Expira em ${formatarDataHora(t.expiraEm)}`}
                      </p>
                    </div>
                    {t.revogadoEm ? (
                      <Pilula tom="gray">Revogado</Pilula>
                    ) : (
                      <Botao tamanho="sm" onClick={() => revogar(t)}>
                        Revogar
                      </Botao>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <p className="mb-2.5 mt-7 text-xs font-semibold text-ink3">Atividade do agente</p>
      <ul className="flex flex-col overflow-hidden rounded-[14px] border border-line bg-surface">
        {registro.map((r) => (
          <li key={r.id} className="flex items-center gap-3 border-b border-line px-4 py-[11px] last:border-b-0">
            <span className={classes("size-1.5 shrink-0 rounded-full", r.sucesso ? "bg-s-green" : "bg-s-red")} aria-label={r.sucesso ? "Deu certo" : "Falhou"} />
            <div className="min-w-0 flex-1">
              <p className={classes("truncate text-[13.5px] font-medium", r.desfeitoEm && "text-ink3 line-through")}>{NOME_DA_FERRAMENTA[r.ferramenta] ?? r.ferramenta}</p>
              <p className="text-xs text-ink3">
                {formatarDataHora(r.criadoEm)}
                {r.sucesso ? "" : " · falhou"}
              </p>
            </div>
            {r.desfazer && !r.desfeitoEm && (
              <Botao tamanho="sm" variante="discreta" onClick={() => desfazer(r)}>
                <ArrowCounterClockwiseIcon size={15} />
                Desfazer
              </Botao>
            )}
            {r.desfeitoEm && <span className="text-xs text-ink3">Desfeito</span>}
          </li>
        ))}
        {registro.length === 0 && <li className="px-5 py-6 text-center text-[13px] text-ink2">O agente ainda não fez nada por aqui.</li>}
      </ul>
    </>
  );
}

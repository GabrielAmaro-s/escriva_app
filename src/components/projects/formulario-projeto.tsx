"use client";

import { BriefcaseIcon, ScalesIcon, XIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Botao, BotaoIcone } from "@/components/ui/botao";
import { AreaTexto, CampoTexto, RotuloCampo, Selecao } from "@/components/ui/campo";
import { Janela } from "@/components/ui/janela";
import { Marcador } from "@/components/ui/pecas";
import {
  AREAS,
  FASES,
  POLOS,
  ROTULO_AREA,
  ROTULO_FASE,
  ROTULO_POLO,
  areaSugeridaDoModelo,
  detalhesProcessoVazios,
  formatarNumeroCnj,
  modeloSugeridoDaArea,
} from "@/domain/processo";
import { NOME_DO_TOM, SUGESTOES_DE_SERVICO, TONS_PROJETO, campanhaVazia, dadosProjetoVazios, validarDadosProjeto } from "@/domain/projeto";
import { MODELOS_DE_QUADRO, type ModeloQuadro, modeloPadrao, modelosDoTipo } from "@/domain/quadro";
import type { AreaProcesso, DadosProjeto, DetalhesProcesso, FaseProcesso, PoloProcesso, TipoProjeto } from "@/domain/tipos";
import { useClientes } from "@/hooks/use-clientes";
import { classes } from "@/lib/classes";

const TIPOS = [
  { tipo: "project" as const, nome: "Processo", dica: "Ação judicial com prazos, audiências e tarefas.", icone: ScalesIcon },
  { tipo: "campaign" as const, nome: "Consultivo", dica: "Contrato, parecer, notificação ou outro trabalho fora do processo.", icone: BriefcaseIcon },
];

/** O que vai junto com os dados ao salvar. */
export interface ExtrasDoFormulario {
  /** Só ao criar; na edição o quadro já existe. */
  modelo?: ModeloQuadro;
  /** Nome digitado que não bate com nenhum cliente: cadastra antes de salvar. */
  clienteNovo?: string;
}

const chipClasse = (ativo: boolean) =>
  classes(
    "h-7 rounded-full border px-3 text-[12.5px] transition-[background,border-color,color] duration-150",
    ativo ? "border-primary-line bg-primary-soft text-primary" : "border-line bg-surface text-ink2 hover:text-ink",
  );

export function FormularioProjeto({
  aberto,
  inicial,
  editando,
  aoFechar,
  aoEnviar,
}: {
  aberto: boolean;
  inicial: DadosProjeto;
  editando: boolean;
  aoFechar: () => void;
  aoEnviar: (dados: DadosProjeto, extras: ExtrasDoFormulario) => Promise<boolean>;
}) {
  const { clientes, nomeDoCliente } = useClientes();
  const [formulario, setFormulario] = useState<DadosProjeto>(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [modelo, setModelo] = useState<ModeloQuadro>(modeloPadrao(inicial.kind));
  // Área e modelo se sugerem até a pessoa escolher os dois.
  const [tocados, setTocados] = useState({ area: false, modelo: false });
  const [nomeCliente, setNomeCliente] = useState("");
  const [valorTexto, setValorTexto] = useState("");

  // Reinicia só ao abrir, para não perder o que está sendo digitado.
  useEffect(() => {
    if (!aberto) return;
    setFormulario(inicial.processo?.numeroCnj ? { ...inicial, processo: { ...inicial.processo, numeroCnj: formatarNumeroCnj(inicial.processo.numeroCnj) } } : inicial);
    setErro(null);
    setModelo(modeloPadrao(inicial.kind));
    setTocados({ area: false, modelo: false });
    setNomeCliente(nomeDoCliente(inicial.clienteId) ?? "");
    setValorTexto(inicial.processo?.valorCausa != null ? String(inicial.processo.valorCausa).replace(".", ",") : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  const ehCampanha = formulario.kind === "campaign";
  const campanha = formulario.campaign ?? campanhaVazia();
  const processo = formulario.processo ?? detalhesProcessoVazios();
  const alterar = (mudanca: Partial<DadosProjeto>) => setFormulario((f) => ({ ...f, ...mudanca }));
  const alterarCampanha = (mudanca: Partial<typeof campanha>) => alterar({ campaign: { ...campanha, ...mudanca } });
  const alterarProcesso = (mudanca: Partial<DetalhesProcesso>) => alterar({ processo: { ...processo, ...mudanca } });

  const definirTipo = (tipo: TipoProjeto) => {
    const padrao = dadosProjetoVazios(tipo);
    const novoModelo = modeloPadrao(tipo);
    setModelo(novoModelo);
    setTocados({ area: false, modelo: false });
    setFormulario((f) => ({
      ...f,
      kind: tipo,
      // troca a cor e o ícone padrão só se ainda estiverem no padrão do outro tipo
      color: f.color === dadosProjetoVazios(f.kind).color ? padrao.color : f.color,
      icon: f.icon === dadosProjetoVazios(f.kind).icon ? padrao.icon : f.icon,
      campaign: tipo === "campaign" ? (f.campaign ?? campanhaVazia()) : f.campaign,
      processo: tipo === "project" ? (f.processo ?? detalhesProcessoVazios(areaSugeridaDoModelo(novoModelo))) : f.processo,
    }));
  };

  const escolherModelo = (m: ModeloQuadro) => {
    setModelo(m);
    setTocados((t) => ({ ...t, modelo: true }));
    const area = areaSugeridaDoModelo(m);
    if (!tocados.area && area && !ehCampanha) alterarProcesso({ area });
  };

  const escolherArea = (area: AreaProcesso | null) => {
    alterarProcesso({ area });
    setTocados((t) => ({ ...t, area: true }));
    const sugerido = area ? modeloSugeridoDaArea(area) : null;
    if (!editando && !tocados.modelo && sugerido) setModelo(sugerido);
  };

  // Cliente digitado: existente (pelo nome) ou novo.
  const nomeDigitado = nomeCliente.trim();
  const clienteEscolhido = nomeDigitado ? clientes.find((c) => c.nome.toLowerCase() === nomeDigitado.toLowerCase()) : undefined;
  const clienteNovo = nomeDigitado && !clienteEscolhido ? nomeDigitado : undefined;

  async function enviar(e?: React.FormEvent) {
    e?.preventDefault();
    // "18.500,00" e "18500,5" (vírgula decimal) ou "18500.5" (ponto decimal, sem vírgula).
    const v = valorTexto.trim();
    const valorCausa = v ? Number(v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v) : null;
    if (valorCausa !== null && Number.isNaN(valorCausa)) {
      setErro("O valor da causa precisa ser um número, por exemplo 18500,00.");
      return;
    }
    const dados: DadosProjeto = {
      ...formulario,
      clienteId: clienteEscolhido?.id ?? null,
      processo: ehCampanha ? null : { ...processo, valorCausa },
    };
    const resultado = validarDadosProjeto(dados);
    if (!resultado.ok) {
      setErro(resultado.erro);
      if (resultado.erro === "Dê um nome para continuar.") document.getElementById("np-name")?.focus();
      return;
    }
    setSalvando(true);
    const ok = await aoEnviar(resultado.valor, { modelo: editando ? undefined : modelo, clienteNovo });
    setSalvando(false);
    if (ok) aoFechar();
  }

  const titulo = editando ? (ehCampanha ? "Editar caso consultivo" : "Editar processo") : ehCampanha ? "Novo caso consultivo" : "Novo processo";
  const erroNoNome = erro === "Dê um nome para continuar.";
  const modelos = modelosDoTipo(formulario.kind);

  return (
    <Janela aberta={aberto} aoFechar={aoFechar} rotulo={titulo} className="max-w-[600px] p-6">
      <form onSubmit={enviar} noValidate>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-[-0.02em]">{titulo}</h2>
            <p className="mt-1 text-[13px] text-ink2">
              {editando ? "Ajuste as informações e salve." : "Cadastre um processo ou um caso consultivo para organizar prazos e tarefas."}
            </p>
          </div>
          <BotaoIcone rotulo="Fechar" onClick={aoFechar}>
            <XIcon size={17} weight="bold" />
          </BotaoIcone>
        </div>

        <p className="mb-2 mt-5 text-[12.5px] font-semibold">Tipo</p>
        <div role="radiogroup" aria-label="Tipo" className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2.5">
          {TIPOS.map(({ tipo, nome, dica, icone: Glifo }) => {
            const ativo = formulario.kind === tipo;
            return (
              <button
                key={tipo}
                type="button"
                role="radio"
                aria-checked={ativo}
                onClick={() => definirTipo(tipo)}
                className={classes(
                  "flex items-start gap-[11px] rounded-xl border p-3 text-left text-ink transition-[background,border-color] duration-150",
                  ativo ? "border-primary bg-primary-soft" : "border-line bg-surface hover:border-line2",
                )}
              >
                <Glifo size={20} className={classes("mt-px shrink-0", ativo ? "text-primary" : "text-ink2")} />
                <span>
                  <span className="block text-[13.5px] font-semibold">{nome}</span>
                  <span className="mt-0.5 block text-xs leading-snug text-ink2">{dica}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-[18px]">
          <RotuloCampo htmlFor="np-name" obrigatorio>
            Nome
          </RotuloCampo>
          <CampoTexto
            id="np-name"
            data-autofocus
            aria-required="true"
            aria-invalid={erroNoNome}
            value={formulario.name}
            onChange={(e) => {
              alterar({ name: e.target.value });
              if (erroNoNome) setErro(null);
            }}
            placeholder={ehCampanha ? "Ex.: Contrato de prestação de serviços" : "Ex.: Cobrança de aluguéis, Reclamação trabalhista…"}
            maxLength={120}
            className={erroNoNome ? "border-s-red" : undefined}
          />
          {erroNoNome && (
            <p role="alert" className="mt-1.5 text-xs text-s-red">
              {erro}
            </p>
          )}
        </div>

        <div className="mt-4">
          <RotuloCampo htmlFor="np-cliente">Cliente</RotuloCampo>
          <CampoTexto
            id="np-cliente"
            list="np-clientes"
            value={nomeCliente}
            onChange={(e) => setNomeCliente(e.target.value)}
            placeholder="Escolha ou digite o nome de um cliente novo"
            maxLength={120}
            autoComplete="off"
          />
          <datalist id="np-clientes">
            {clientes.map((c) => (
              <option key={c.id} value={c.nome} />
            ))}
          </datalist>
          {clienteNovo && <p className="mt-1.5 text-xs text-ink3">Cliente novo: será cadastrado com este nome ao salvar.</p>}
        </div>

        {!editando && (
          <div className="mt-4">
            <p className="mb-2 text-[12.5px] font-semibold">Modelo de quadro</p>
            <div role="radiogroup" aria-label="Modelo de quadro" className="flex flex-wrap gap-[7px]">
              {modelos.map((m) => (
                <button key={m} type="button" role="radio" aria-checked={modelo === m} onClick={() => escolherModelo(m)} className={chipClasse(modelo === m)}>
                  {MODELOS_DE_QUADRO[m].nome}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-ink3">Colunas: {MODELOS_DE_QUADRO[modelo].colunas.map((c) => c.title).join(", ")}.</p>
          </div>
        )}

        {!ehCampanha && (
          <>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-4">
              <div className="min-w-[180px] flex-1">
                <RotuloCampo htmlFor="np-area">Área</RotuloCampo>
                <Selecao id="np-area" value={processo.area ?? ""} onChange={(e) => escolherArea((e.target.value || null) as AreaProcesso | null)} className="h-[38px]">
                  <option value="">Sem área</option>
                  {AREAS.map((a) => (
                    <option key={a} value={a}>
                      {ROTULO_AREA[a]}
                    </option>
                  ))}
                </Selecao>
              </div>
              <div className="min-w-[220px] flex-[1.4]">
                <RotuloCampo htmlFor="np-cnj">Número do processo</RotuloCampo>
                <CampoTexto
                  id="np-cnj"
                  value={processo.numeroCnj ?? ""}
                  onChange={(e) => alterarProcesso({ numeroCnj: e.target.value || null })}
                  onBlur={(e) => {
                    const formatado = formatarNumeroCnj(e.target.value.replace(/\D/g, ""));
                    if (formatado.includes("-")) alterarProcesso({ numeroCnj: formatado });
                  }}
                  placeholder="0000000-00.0000.0.00.0000"
                  maxLength={30}
                  inputMode="numeric"
                  autoComplete="off"
                />
              </div>
            </div>

            <details className="group mt-4 rounded-xl border border-line px-3.5 py-2.5" open={editando && Boolean(processo.tribunal || processo.orgao || processo.parteContraria)}>
              <summary className="cursor-pointer text-[12.5px] font-semibold text-ink2">Mais dados do processo</summary>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-4 pb-1">
                <div className="min-w-[120px] flex-1">
                  <RotuloCampo htmlFor="np-tribunal">Tribunal</RotuloCampo>
                  <CampoTexto id="np-tribunal" value={processo.tribunal ?? ""} onChange={(e) => alterarProcesso({ tribunal: e.target.value || null })} placeholder="Ex.: TJRS" maxLength={40} />
                </div>
                <div className="min-w-[200px] flex-[2]">
                  <RotuloCampo htmlFor="np-orgao">Vara ou turma</RotuloCampo>
                  <CampoTexto id="np-orgao" value={processo.orgao ?? ""} onChange={(e) => alterarProcesso({ orgao: e.target.value || null })} placeholder="Ex.: 2ª Vara Cível" maxLength={120} />
                </div>
                <div className="min-w-[140px] flex-1">
                  <RotuloCampo htmlFor="np-polo">Polo do cliente</RotuloCampo>
                  <Selecao id="np-polo" value={processo.polo ?? ""} onChange={(e) => alterarProcesso({ polo: (e.target.value || null) as PoloProcesso | null })} className="h-[38px]">
                    <option value="">Não informado</option>
                    {POLOS.map((p) => (
                      <option key={p} value={p}>
                        {ROTULO_POLO[p]}
                      </option>
                    ))}
                  </Selecao>
                </div>
                <div className="min-w-[200px] flex-[2]">
                  <RotuloCampo htmlFor="np-parte">Parte contrária</RotuloCampo>
                  <CampoTexto id="np-parte" value={processo.parteContraria ?? ""} onChange={(e) => alterarProcesso({ parteContraria: e.target.value || null })} maxLength={200} />
                </div>
                <div className="min-w-[140px] flex-1">
                  <RotuloCampo htmlFor="np-fase">Fase</RotuloCampo>
                  <Selecao id="np-fase" value={processo.fase ?? ""} onChange={(e) => alterarProcesso({ fase: (e.target.value || null) as FaseProcesso | null })} className="h-[38px]">
                    <option value="">Não informada</option>
                    {FASES.map((f) => (
                      <option key={f} value={f}>
                        {ROTULO_FASE[f]}
                      </option>
                    ))}
                  </Selecao>
                </div>
                <div className="min-w-[140px] flex-1">
                  <RotuloCampo htmlFor="np-valor">Valor da causa (R$)</RotuloCampo>
                  <CampoTexto id="np-valor" value={valorTexto} onChange={(e) => setValorTexto(e.target.value)} placeholder="0,00" inputMode="decimal" maxLength={20} />
                </div>
                <div className="w-full">
                  <RotuloCampo htmlFor="np-link">Link dos autos</RotuloCampo>
                  <CampoTexto id="np-link" type="url" value={processo.linkAutos ?? ""} onChange={(e) => alterarProcesso({ linkAutos: e.target.value || null })} placeholder="https://" maxLength={2000} />
                </div>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={processo.segredoJustica}
                  onClick={() => alterarProcesso({ segredoJustica: !processo.segredoJustica })}
                  className="flex items-center gap-2 border-0 bg-transparent p-0 text-[13px] text-ink"
                >
                  <Marcador marcado={processo.segredoJustica} />
                  Segredo de justiça
                </button>
              </div>
            </details>
          </>
        )}

        {ehCampanha && (
          <>
            <div className="mt-4">
              <RotuloCampo htmlFor="np-servico">Tipo de serviço</RotuloCampo>
              <CampoTexto
                id="np-servico"
                list="np-servicos"
                value={campanha.tipoServico ?? ""}
                onChange={(e) => alterarCampanha({ tipoServico: e.target.value || null })}
                placeholder="Ex.: Contrato, Parecer…"
                maxLength={80}
              />
              <datalist id="np-servicos">
                {SUGESTOES_DE_SERVICO.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
              <div className="mt-2 flex flex-wrap gap-[7px]">
                {SUGESTOES_DE_SERVICO.map((s) => (
                  <button key={s} type="button" aria-pressed={campanha.tipoServico === s} onClick={() => alterarCampanha({ tipoServico: s })} className={chipClasse(campanha.tipoServico === s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4">
              <RotuloCampo htmlFor="np-objective">Pedido do cliente</RotuloCampo>
              <CampoTexto
                id="np-objective"
                value={campanha.objective ?? ""}
                onChange={(e) => alterarCampanha({ objective: e.target.value })}
                placeholder="Ex.: Revisar o contrato antes da assinatura"
              />
            </div>
          </>
        )}

        <div className="mt-4">
          <RotuloCampo htmlFor="np-desc">Descrição</RotuloCampo>
          <AreaTexto
            id="np-desc"
            rows={2}
            className="resize-none"
            value={formulario.description ?? ""}
            onChange={(e) => alterar({ description: e.target.value })}
            placeholder="Resuma o caso em poucas palavras…"
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-4">
          <div className="flex-none">
            <p className="mb-2 text-[12.5px] font-semibold">Cor</p>
            <div role="radiogroup" aria-label="Cor" className="flex h-[38px] items-center gap-[9px]">
              {TONS_PROJETO.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={formulario.color === t}
                  aria-label={NOME_DO_TOM[t]}
                  title={NOME_DO_TOM[t]}
                  data-tone={t}
                  onClick={() => alterar({ color: t })}
                  className={classes(
                    "size-[22px] rounded-full border-2 border-surface bg-tone p-0 transition-shadow duration-150",
                    formulario.color === t ? "shadow-[0_0_0_2px_var(--ink)]" : "shadow-none",
                  )}
                />
              ))}
            </div>
          </div>
          {ehCampanha && (
            <div className="min-w-[130px] flex-1">
              <RotuloCampo htmlFor="np-start">Recebido em</RotuloCampo>
              <CampoTexto
                id="np-start"
                type="date"
                className="px-2.5 text-[13px]"
                value={campanha.startsOn ?? ""}
                onChange={(e) => alterarCampanha({ startsOn: e.target.value || null })}
              />
            </div>
          )}
          <div className="min-w-[130px] flex-1">
            <RotuloCampo htmlFor="np-due">{ehCampanha ? "Prazo de entrega" : "Prazo"}</RotuloCampo>
            <CampoTexto
              id="np-due"
              type="date"
              className="px-2.5 text-[13px]"
              value={(ehCampanha ? campanha.endsOn : formulario.dueOn) ?? ""}
              onChange={(e) => (ehCampanha ? alterarCampanha({ endsOn: e.target.value || null }) : alterar({ dueOn: e.target.value || null }))}
            />
          </div>
        </div>

        {erro && !erroNoNome && (
          <p role="alert" className="mt-4 text-xs text-s-red">
            {erro}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2.5">
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao variante="primaria" type="submit" disabled={salvando} className="px-[18px]">
            {editando ? "Salvar alterações" : ehCampanha ? "Criar caso consultivo" : "Criar processo"}
          </Botao>
        </div>
      </form>
    </Janela>
  );
}

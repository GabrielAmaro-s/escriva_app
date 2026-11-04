"use client";

import { MegaphoneIcon, PackageIcon, PlusIcon, XIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Botao, BotaoIcone } from "@/components/ui/botao";
import { AreaTexto, CampoTexto, RotuloCampo } from "@/components/ui/campo";
import { Janela } from "@/components/ui/janela";
import { NOME_DO_TOM, SUGESTOES_DE_CANAIS, TONS_PROJETO, campanhaVazia, dadosProjetoVazios, validarDadosProjeto } from "@/domain/projeto";
import type { DadosProjeto, TipoProjeto } from "@/domain/tipos";
import { classes } from "@/lib/classes";

const TIPOS = [
  { tipo: "project" as const, nome: "Projeto", dica: "Organize tarefas, prazos e entregas.", icone: PackageIcon },
  { tipo: "campaign" as const, nome: "Campanha", dica: "Planeje e acompanhe uma campanha específica.", icone: MegaphoneIcon },
];

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
  aoEnviar: (dados: DadosProjeto) => Promise<boolean>;
}) {
  const [formulario, setFormulario] = useState<DadosProjeto>(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [outroCanal, setOutroCanal] = useState("");

  // Reinicia só ao abrir, para não perder o que está sendo digitado.
  useEffect(() => {
    if (aberto) {
      setFormulario(inicial);
      setErro(null);
      setOutroCanal("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  const ehCampanha = formulario.kind === "campaign";
  const campanha = formulario.campaign ?? campanhaVazia();
  const alterar = (mudanca: Partial<DadosProjeto>) => setFormulario((f) => ({ ...f, ...mudanca }));
  const alterarCampanha = (mudanca: Partial<typeof campanha>) => alterar({ campaign: { ...campanha, ...mudanca } });

  const definirTipo = (tipo: TipoProjeto) => {
    const padrao = dadosProjetoVazios(tipo);
    setFormulario((f) => ({
      ...f,
      kind: tipo,
      // troca a cor e o ícone padrão só se ainda estiverem no padrão do outro tipo
      color: f.color === dadosProjetoVazios(f.kind).color ? padrao.color : f.color,
      icon: f.icon === dadosProjetoVazios(f.kind).icon ? padrao.icon : f.icon,
      campaign: tipo === "campaign" ? (f.campaign ?? campanhaVazia()) : f.campaign,
    }));
  };

  const canais = [...SUGESTOES_DE_CANAIS, ...campanha.channels.filter((c) => !SUGESTOES_DE_CANAIS.includes(c))];
  const alternarCanal = (c: string) =>
    alterarCampanha({ channels: campanha.channels.includes(c) ? campanha.channels.filter((x) => x !== c) : [...campanha.channels, c] });

  async function enviar(e?: React.FormEvent) {
    e?.preventDefault();
    const resultado = validarDadosProjeto(formulario);
    if (!resultado.ok) {
      setErro(resultado.erro);
      document.getElementById("np-name")?.focus();
      return;
    }
    setSalvando(true);
    const ok = await aoEnviar(resultado.valor);
    setSalvando(false);
    if (ok) aoFechar();
  }

  const titulo = editando ? (ehCampanha ? "Editar campanha" : "Editar projeto") : ehCampanha ? "Nova campanha" : "Novo projeto";
  const erroNoNome = erro === "Dê um nome para continuar.";

  return (
    <Janela aberta={aberto} aoFechar={aoFechar} rotulo={titulo} className="max-w-[560px] p-6">
      <form onSubmit={enviar} noValidate>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-[-0.02em]">{titulo}</h2>
            <p className="mt-1 text-[13px] text-ink2">
              {editando ? "Ajuste as informações e salve." : "Crie um novo projeto ou campanha para organizar suas tarefas."}
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
            placeholder={ehCampanha ? "Ex.: Campanha de Inverno" : "Ex.: Novo site, Revisão de processos…"}
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
          <RotuloCampo htmlFor="np-desc">Descrição</RotuloCampo>
          <AreaTexto
            id="np-desc"
            rows={2}
            className="resize-none"
            value={formulario.description ?? ""}
            onChange={(e) => alterar({ description: e.target.value })}
            placeholder="Descreva brevemente o objetivo…"
          />
        </div>

        {ehCampanha && (
          <>
            <div className="mt-4">
              <RotuloCampo htmlFor="np-objective">Objetivo</RotuloCampo>
              <CampoTexto
                id="np-objective"
                value={campanha.objective ?? ""}
                onChange={(e) => alterarCampanha({ objective: e.target.value })}
                placeholder="Ex.: Geração de leads"
              />
            </div>
            <div className="mt-4">
              <p className="mb-2 text-[12.5px] font-semibold">Canais de divulgação</p>
              <div className="flex flex-wrap gap-[7px]">
                {canais.map((c) => {
                  const ativo = campanha.channels.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      aria-pressed={ativo}
                      onClick={() => alternarCanal(c)}
                      className={classes(
                        "h-7 rounded-full border px-3 text-[12.5px] transition-[background,border-color,color] duration-150",
                        ativo ? "border-primary-line bg-primary-soft text-primary" : "border-line bg-surface text-ink2 hover:text-ink",
                      )}
                    >
                      {c}
                    </button>
                  );
                })}
                <label className="flex h-7 items-center gap-1 rounded-full border border-dashed border-line2 pl-2.5 pr-1 text-ink3 focus-within:border-primary">
                  <PlusIcon size={12} weight="bold" />
                  <input
                    value={outroCanal}
                    onChange={(e) => setOutroCanal(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      e.preventDefault();
                      const v = outroCanal.trim();
                      if (v && !campanha.channels.some((c) => c.toLowerCase() === v.toLowerCase())) alterarCampanha({ channels: [...campanha.channels, v] });
                      setOutroCanal("");
                    }}
                    placeholder="Outro"
                    aria-label="Adicionar outro canal"
                    className="w-16 bg-transparent text-[12.5px] text-ink outline-none placeholder:text-ink3"
                  />
                </label>
              </div>
            </div>
          </>
        )}

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
              <RotuloCampo htmlFor="np-start">Início</RotuloCampo>
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
            <RotuloCampo htmlFor="np-due">{ehCampanha ? "Fim" : "Prazo"}</RotuloCampo>
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
            {editando ? "Salvar alterações" : ehCampanha ? "Criar campanha" : "Criar projeto"}
          </Botao>
        </div>
      </form>
    </Janela>
  );
}

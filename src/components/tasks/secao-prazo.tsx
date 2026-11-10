"use client";

import { CalculatorIcon, ClockCounterClockwiseIcon, WarningIcon } from "@phosphor-icons/react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Botao } from "@/components/ui/botao";
import { Selecao, classeControle } from "@/components/ui/campo";
import { dataNoFuso, formatarDataHora, fusoDoAparelho, paraCampoDataHora } from "@/domain/datas";
import {
  AVISO_CONTAGEM_EM_VALIDACAO,
  REGRAS,
  REGRAS_LISTA,
  ROTULO_MEIO,
  ROTULO_TIPO,
  alteracaoDePrazo,
  formatarData,
  montarContagem,
  regraDaArea,
  tribunalDoProcesso,
  validarDadosPrazo,
} from "@/domain/prazos";
import type { AlteracaoRegistrada, AlteracaoTarefa, Feriado, MeioIntimacao, Projeto, RegraPrazo, Tarefa, TipoTarefa } from "@/domain/tipos";
import { classes } from "@/lib/classes";

const TIPOS: TipoTarefa[] = ["providencia", "prazo", "audiencia"];
const classeData = classes(classeControle, "h-9 rounded-[9px] px-2.5 text-[13px]");

function Rotulo({ children }: { children: ReactNode }) {
  return <span className="mb-1 block text-[11.5px] font-medium text-ink2">{children}</span>;
}

/** Aviso de que a contagem ainda está em validação (some quando a constante vira null). */
export function AvisoValidacao() {
  if (!AVISO_CONTAGEM_EM_VALIDACAO) return null;
  return (
    <p role="note" className="flex items-start gap-1.5 text-[11.5px] leading-snug text-s-amber">
      <WarningIcon size={13} weight="fill" className="mt-px shrink-0" />
      {AVISO_CONTAGEM_EM_VALIDACAO}
    </p>
  );
}

/** Tipo, prazo fatal e prazo interno, ou data e local da audiência (coluna da direita da janela). */
export function CamposDoTipo({ tarefa, alterar }: { tarefa: Tarefa; alterar: (a: AlteracaoTarefa) => void }) {
  const [horario, setHorario] = useState("");
  const [local, setLocal] = useState("");
  useEffect(() => {
    setHorario(tarefa.horarioAudiencia ? paraCampoDataHora(tarefa.horarioAudiencia) : "");
    setLocal(tarefa.localAudiencia ?? "");
  }, [tarefa.id, tarefa.horarioAudiencia, tarefa.localAudiencia]);

  const confirmarHorario = () => {
    const iso = horario ? new Date(horario).toISOString() : null;
    if (iso === tarefa.horarioAudiencia) return;
    // A data da audiência também vira a data da tarefa, para aparecer nas listas e no quadro.
    alterar({ horarioAudiencia: iso, ...(iso ? { dueOn: dataNoFuso(new Date(iso), fusoDoAparelho()) } : {}) });
  };
  const confirmarLocal = () => {
    const limpo = local.trim().slice(0, 200) || null;
    if (limpo !== tarefa.localAudiencia) alterar({ localAudiencia: limpo });
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="mb-[7px] text-xs font-semibold">Tipo</p>
        <Selecao aria-label="Tipo da tarefa" value={tarefa.tipo} onChange={(e) => alterar({ tipo: e.target.value as TipoTarefa })}>
          {TIPOS.map((t) => (
            <option key={t} value={t}>
              {ROTULO_TIPO[t]}
            </option>
          ))}
        </Selecao>
      </div>

      {tarefa.tipo === "prazo" && (
        <>
          <label className="block">
            <Rotulo>Prazo fatal</Rotulo>
            <input
              type="date"
              aria-label="Prazo fatal"
              value={tarefa.prazoFatal ?? ""}
              onChange={(e) => alterar({ prazoFatal: e.target.value || null })}
              className={classes(classeData, "font-semibold text-s-red")}
            />
          </label>
          <label className="block">
            <Rotulo>Prazo interno</Rotulo>
            <input
              type="date"
              aria-label="Prazo interno"
              value={tarefa.dueOn ?? ""}
              max={tarefa.prazoFatal ?? undefined}
              onChange={(e) => alterar({ dueOn: e.target.value || null })}
              className={classeData}
            />
          </label>
        </>
      )}

      {tarefa.tipo === "audiencia" && (
        <>
          <label className="block">
            <Rotulo>Data e hora</Rotulo>
            <input
              type="datetime-local"
              aria-label="Data e hora da audiência"
              value={horario}
              onChange={(e) => setHorario(e.target.value)}
              onBlur={confirmarHorario}
              className={classeData}
            />
          </label>
          <label className="block">
            <Rotulo>Local</Rotulo>
            <input
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              onBlur={confirmarLocal}
              maxLength={200}
              placeholder="Sala, foro ou link"
              aria-label="Local da audiência"
              className={classeData}
            />
          </label>
        </>
      )}

      {tarefa.tipo !== "providencia" && (
        <p className="text-[11.5px] leading-snug text-ink3">
          Lembretes automáticos 3 e 1 dia útil antes e no dia{tarefa.tipo === "audiencia" ? " (2 h antes do horário)" : " do prazo fatal"}.
        </p>
      )}
    </div>
  );
}

/** Calculadora do prazo com a memória do cálculo (coluna da esquerda, só no tipo prazo). */
export function ContagemDoPrazo({
  tarefa,
  projeto,
  feriados,
  margemPadrao,
  alterar,
}: {
  tarefa: Tarefa;
  projeto: Projeto | undefined;
  feriados: Feriado[];
  margemPadrao: number;
  alterar: (a: AlteracaoTarefa) => void;
}) {
  const salva = tarefa.contagem;
  const tribunal = tribunalDoProcesso(projeto?.processo);
  const [aberta, setAberta] = useState(!tarefa.prazoFatal);
  const [inicio, setInicio] = useState(salva?.inicio ?? "");
  const [meio, setMeio] = useState<MeioIntimacao>(salva?.meio ?? "dje");
  const [dias, setDias] = useState(String(salva?.dias ?? 15));
  const [regra, setRegra] = useState<RegraPrazo>(salva?.regra ?? regraDaArea(projeto?.processo?.area));
  const [emDobro, setEmDobro] = useState(salva?.emDobro ?? false);
  const [recesso, setRecesso] = useState(salva?.suspenderNoRecesso ?? REGRAS[salva?.regra ?? regraDaArea(projeto?.processo?.area)].suspenderNoRecesso);
  const [margem, setMargem] = useState(String(salva?.margem ?? margemPadrao));

  useEffect(() => {
    if (!salva) setMargem(String(margemPadrao));
  }, [margemPadrao, salva]);

  const trocarRegra = (r: RegraPrazo) => {
    setRegra(r);
    setRecesso(REGRAS[r].suspenderNoRecesso);
  };

  const calculo = useMemo(() => {
    const dados = { inicio, meio, dias: Number(dias), regra, emDobro, suspenderNoRecesso: recesso, margem: Number(margem) };
    if (!validarDadosPrazo(dados).ok) return null;
    return montarContagem(dados, feriados, tribunal);
  }, [inicio, meio, dias, regra, emDobro, recesso, margem, feriados, tribunal]);

  const igualAoSalvo = calculo && salva && calculo.contagem.vencimento === tarefa.prazoFatal && calculo.contagem.memoria === salva.memoria;

  return (
    <div>
      <div className="mb-[7px] flex items-center gap-2">
        <p className="text-xs font-semibold">Contagem do prazo</p>
        <Botao tamanho="sm" variante="discreta" className="ml-auto" onClick={() => setAberta((a) => !a)}>
          <CalculatorIcon size={14} />
          {aberta ? "Fechar cálculo" : salva ? "Recalcular" : "Calcular"}
        </Botao>
      </div>

      {salva && !aberta && (
        <div className="flex flex-col gap-1.5 rounded-[10px] border border-line bg-bg px-3 py-2.5">
          <p className="text-[13px] leading-normal text-ink">{salva.memoria}</p>
          <AvisoValidacao />
        </div>
      )}
      {!salva && !aberta && <p className="text-[12.5px] text-ink3">Prazo fatal informado à mão, sem memória de cálculo.</p>}

      {aberta && (
        <div className="flex flex-col gap-3 rounded-[10px] border border-line px-3 py-3">
          <div className="grid grid-cols-2 gap-2.5 max-[480px]:grid-cols-1">
            <label className="block">
              <Rotulo>{meio === "dje" ? "Disponibilizado em" : meio === "portal" ? "Ciência em" : "Intimado em"}</Rotulo>
              <input type="date" aria-label="Data da intimação" value={inicio} onChange={(e) => setInicio(e.target.value)} className={classeData} />
            </label>
            <label className="block">
              <Rotulo>Meio</Rotulo>
              <Selecao aria-label="Meio da intimação" value={meio} onChange={(e) => setMeio(e.target.value as MeioIntimacao)}>
                {(Object.keys(ROTULO_MEIO) as MeioIntimacao[]).map((m) => (
                  <option key={m} value={m}>
                    {ROTULO_MEIO[m]}
                  </option>
                ))}
              </Selecao>
            </label>
            <label className="block">
              <Rotulo>Dias</Rotulo>
              <input type="number" min={1} max={365} aria-label="Quantidade de dias" value={dias} onChange={(e) => setDias(e.target.value)} className={classeData} />
            </label>
            <label className="block">
              <Rotulo>Regra</Rotulo>
              <Selecao aria-label="Regra de contagem" value={regra} onChange={(e) => trocarRegra(e.target.value as RegraPrazo)}>
                {REGRAS_LISTA.map((r) => (
                  <option key={r} value={r}>
                    {REGRAS[r].rotulo}
                  </option>
                ))}
              </Selecao>
            </label>
            <label className="block">
              <Rotulo>Margem do prazo interno (dias úteis)</Rotulo>
              <input type="number" min={0} max={30} aria-label="Margem do prazo interno" value={margem} onChange={(e) => setMargem(e.target.value)} className={classeData} />
            </label>
          </div>
          <div className="flex flex-col gap-1.5 text-[12.5px] text-ink2">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={emDobro} onChange={(e) => setEmDobro(e.target.checked)} />
              Prazo em dobro (Fazenda Pública, Defensoria)
            </label>
            {regra === "penal" ? (
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={!recesso} onChange={(e) => setRecesso(!e.target.checked)} />
                Exceção do art. 798-A do CPP (réu preso, Maria da Penha ou medida urgente): corre no recesso
              </label>
            ) : (
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={recesso} onChange={(e) => setRecesso(e.target.checked)} />
                Suspender no recesso (20/12 a 20/01)
              </label>
            )}
          </div>
          <p className="text-[11.5px] text-ink3">
            {tribunal
              ? `Feriados nacionais, do ${tribunal} e os seus feriados locais.`
              : "Tribunal não identificado: preencha o número ou o tribunal no processo para incluir os feriados dele."}
          </p>

          {calculo ? (
            <div className="flex flex-col gap-2 rounded-[10px] bg-bg px-3 py-2.5">
              <p className="text-[13.5px] font-semibold text-ink">
                Vence em {formatarData(calculo.contagem.vencimento)} · prazo interno {formatarData(calculo.prazoInterno)}
              </p>
              <p className="text-[12.5px] leading-normal text-ink2">{calculo.contagem.memoria}</p>
              <AvisoValidacao />
              <div>
                <Botao
                  tamanho="sm"
                  variante="primaria"
                  disabled={Boolean(igualAoSalvo)}
                  onClick={() => {
                    alterar(alteracaoDePrazo(calculo.contagem, calculo.prazoInterno));
                    setAberta(false);
                  }}
                >
                  {tarefa.prazoFatal ? "Substituir pelo novo cálculo" : "Usar este cálculo"}
                </Botao>
              </div>
            </div>
          ) : (
            <p className="text-[12.5px] text-ink3">Informe a data e a quantidade de dias para ver o vencimento.</p>
          )}
        </div>
      )}
    </div>
  );
}

const ROTULO_CAMPO: Record<AlteracaoRegistrada["campo"], string> = { due_on: "Prazo interno", prazo_fatal: "Prazo fatal" };

/** Quem mudou o prazo, quando e de onde (app ou agente). */
export function HistoricoDoPrazo({ carregar }: { carregar: () => Promise<AlteracaoRegistrada[]> }) {
  const [lista, setLista] = useState<AlteracaoRegistrada[] | null>(null);
  const [erro, setErro] = useState(false);

  if (!lista) {
    return (
      <Botao
        tamanho="sm"
        variante="discreta"
        onClick={() =>
          carregar()
            .then(setLista)
            .catch(() => setErro(true))
        }
      >
        <ClockCounterClockwiseIcon size={14} />
        {erro ? "Não deu para carregar. Tentar de novo" : "Ver histórico do prazo"}
      </Botao>
    );
  }
  if (!lista.length) return <p className="text-[12.5px] text-ink3">Nenhuma mudança de prazo registrada.</p>;
  return (
    <ul className="flex flex-col gap-1 text-[12.5px] text-ink2">
      {lista.map((a) => (
        <li key={a.id}>
          <span className="text-ink3">{formatarDataHora(a.criadoEm)}</span> · {ROTULO_CAMPO[a.campo]}: {a.antes ? formatarData(a.antes) : "vazio"} →{" "}
          {a.depois ? formatarData(a.depois) : "vazio"}
          {a.origem === "agente" && <span className="text-ink3"> (pelo agente)</span>}
        </li>
      ))}
    </ul>
  );
}

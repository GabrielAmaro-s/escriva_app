"use client";

import { TrashIcon, XIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Botao, BotaoIcone } from "@/components/ui/botao";
import { AreaTexto, CampoTexto, RotuloCampo } from "@/components/ui/campo";
import { Janela } from "@/components/ui/janela";
import { ROTULO_TIPO_CLIENTE, clienteVazio, formatarDocumento, paraDadosCliente, validarDadosCliente } from "@/domain/cliente";
import type { Cliente, DadosCliente, Projeto, TipoCliente } from "@/domain/tipos";
import { useClientes } from "@/hooks/use-clientes";
import { useProjetos } from "@/hooks/use-projetos";
import { classes } from "@/lib/classes";

/** Janela para cadastrar ou editar um cliente. Na edição, lista os processos e casos consultivos dele. */
export function FormularioCliente({ aberto, cliente, aoFechar }: { aberto: boolean; cliente: Cliente | null; aoFechar: () => void }) {
  const estado = useClientes();
  const { projetos } = useProjetos();
  const [formulario, setFormulario] = useState<DadosCliente>(clienteVazio());
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Reinicia só ao abrir, para não perder o que está sendo digitado.
  useEffect(() => {
    if (!aberto) return;
    const inicial = cliente ? paraDadosCliente(cliente) : clienteVazio();
    setFormulario({ ...inicial, documento: formatarDocumento(inicial.documento) || null });
    setErro(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  const alterar = (mudanca: Partial<DadosCliente>) => {
    setFormulario((f) => ({ ...f, ...mudanca }));
    setErro(null);
  };
  const casos: Projeto[] = cliente ? projetos.filter((p) => p.clienteId === cliente.id) : [];

  async function enviar(e?: React.FormEvent) {
    e?.preventDefault();
    const resultado = validarDadosCliente(formulario);
    if (!resultado.ok) {
      setErro(resultado.erro);
      return;
    }
    setSalvando(true);
    const salvo = cliente ? await estado.atualizar(cliente.id, resultado.valor) : await estado.criar(resultado.valor);
    setSalvando(false);
    if (salvo) aoFechar();
  }

  const titulo = cliente ? "Editar cliente" : "Novo cliente";
  const ehPj = formulario.tipo === "pj";

  return (
    <Janela aberta={aberto} aoFechar={aoFechar} rotulo={titulo} className="max-w-[520px] p-6">
      <form onSubmit={enviar} noValidate>
        <div className="flex items-start justify-between">
          <h2 className="text-xl font-bold tracking-[-0.02em]">{titulo}</h2>
          <BotaoIcone rotulo="Fechar" onClick={aoFechar}>
            <XIcon size={17} weight="bold" />
          </BotaoIcone>
        </div>

        <div role="radiogroup" aria-label="Tipo de cliente" className="mt-5 flex gap-2">
          {(["pf", "pj"] as TipoCliente[]).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={formulario.tipo === t}
              onClick={() => alterar({ tipo: t })}
              className={classes(
                "h-8 rounded-full border px-3.5 text-[12.5px] font-medium transition-[background,border-color,color] duration-150",
                formulario.tipo === t ? "border-primary-line bg-primary-soft text-primary" : "border-line bg-surface-raised text-ink-muted hover:text-ink",
              )}
            >
              {ROTULO_TIPO_CLIENTE[t]}
            </button>
          ))}
        </div>

        <div className="mt-4">
          <RotuloCampo htmlFor="cl-nome" obrigatorio>
            Nome
          </RotuloCampo>
          <CampoTexto
            id="cl-nome"
            data-autofocus
            value={formulario.nome}
            onChange={(e) => alterar({ nome: e.target.value })}
            placeholder={ehPj ? "Razão social" : "Nome completo"}
            maxLength={120}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-4">
          <div className="min-w-[180px] flex-1">
            <RotuloCampo htmlFor="cl-doc">{ehPj ? "CNPJ" : "CPF"}</RotuloCampo>
            <CampoTexto
              id="cl-doc"
              value={formulario.documento ?? ""}
              onChange={(e) => alterar({ documento: e.target.value || null })}
              placeholder={ehPj ? "00.000.000/0000-00" : "000.000.000-00"}
              maxLength={20}
              autoComplete="off"
            />
          </div>
          <div className="min-w-[160px] flex-1">
            <RotuloCampo htmlFor="cl-tel">Telefone</RotuloCampo>
            <CampoTexto id="cl-tel" type="tel" value={formulario.telefone ?? ""} onChange={(e) => alterar({ telefone: e.target.value || null })} maxLength={30} />
          </div>
        </div>

        <div className="mt-4">
          <RotuloCampo htmlFor="cl-email">E-mail</RotuloCampo>
          <CampoTexto id="cl-email" type="email" value={formulario.email ?? ""} onChange={(e) => alterar({ email: e.target.value || null })} maxLength={200} />
        </div>

        <div className="mt-4">
          <RotuloCampo htmlFor="cl-obs">Observações</RotuloCampo>
          <AreaTexto id="cl-obs" rows={3} className="resize-none" value={formulario.observacoes ?? ""} onChange={(e) => alterar({ observacoes: e.target.value || null })} maxLength={2000} />
        </div>

        {cliente && (
          <div className="mt-4">
            <p className="mb-1.5 text-[12.5px] font-semibold">Processos e casos consultivos</p>
            {casos.length ? (
              <ul className="flex flex-col gap-1">
                {casos.map((p) => (
                  <li key={p.id}>
                    <Link href={`/projetos/${p.id}`} onClick={aoFechar} className="text-[13px] font-medium text-primary">
                      {p.name}
                    </Link>
                    <span className="text-xs text-ink-muted"> · {p.kind === "campaign" ? "Consultivo" : "Processo"}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-ink-muted">Nenhum processo ou caso consultivo ainda.</p>
            )}
          </div>
        )}

        {erro && (
          <p role="alert" className="mt-4 text-xs text-fatal">
            {erro}
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2.5">
          {cliente ? (
            <Botao
              onClick={() => {
                estado.excluir(cliente.id);
                aoFechar();
              }}
              className="text-fatal"
            >
              <TrashIcon size={15} />
              Excluir
            </Botao>
          ) : (
            <span />
          )}
          <div className="flex gap-2.5">
            <Botao onClick={aoFechar}>Cancelar</Botao>
            <Botao variante="primaria" type="submit" disabled={salvando} className="px-[18px]">
              {cliente ? "Salvar alterações" : "Cadastrar cliente"}
            </Botao>
          </div>
        </div>
      </form>
    </Janela>
  );
}

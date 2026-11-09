"use client";

import { DownloadSimpleIcon, UploadSimpleIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Botao } from "@/components/ui/botao";
import { useAviso } from "@/components/ui/aviso";
import { obterRepositorio } from "@/data";
import { arquivarDadosDoNavegador, criarRepositorioLocal, lerDadosDoNavegador } from "@/data/local/repositorio-local";
import { supabaseConfigurado } from "@/data/supabase/cliente";
import { hojeIso } from "@/domain/quadro";
import { useProjetos } from "@/hooks/use-projetos";
import { chamarApi } from "@/lib/chamar-api";
import { descreverResumo, exportarDados, type ResumoImportacao } from "@/services/importacao";
import { LinhaConfiguracao } from "./linha-configuracao";

const mensagem = (e: unknown) => (e instanceof Error ? e.message : "Algo deu errado. Tente de novo.");

/** Exportar tudo em JSON e, com Supabase, trazer para a conta o que ficou no modo local. */
export function SecaoDados() {
  const avisar = useAviso();
  const { recarregar } = useProjetos();
  const [exportando, setExportando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [projetosNoNavegador, setProjetosNoNavegador] = useState(0);

  useEffect(() => {
    if (supabaseConfigurado) setProjetosNoNavegador(lerDadosDoNavegador()?.projects.length ?? 0);
  }, []);

  async function exportar() {
    setExportando(true);
    try {
      const dados = await exportarDados(obterRepositorio());
      const url = URL.createObjectURL(new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `myplan-${hojeIso()}.json`;
      link.click();
      URL.revokeObjectURL(url);
      avisar({ texto: "Arquivo exportado", tom: "info" });
    } catch (e) {
      avisar({ texto: mensagem(e), tom: "erro" });
    } finally {
      setExportando(false);
    }
  }

  async function importarDoNavegador() {
    const locais = lerDadosDoNavegador();
    if (!locais) return;
    setImportando(true);
    try {
      const arquivo = await exportarDados(criarRepositorioLocal({ dados: locais }));
      const resumo = await chamarApi<ResumoImportacao>("/api/importar", { metodo: "POST", corpo: arquivo });
      arquivarDadosDoNavegador();
      setProjetosNoNavegador(0);
      recarregar();
      avisar({ texto: descreverResumo(resumo), tom: "info" });
    } catch (e) {
      avisar({ texto: mensagem(e), tom: "erro" });
    } finally {
      setImportando(false);
    }
  }

  return (
    <>
      <p className="mb-2.5 mt-7 text-xs font-semibold text-ink3">Dados</p>
      <div className="rounded-[14px] border border-line bg-surface px-[18px]">
        <LinhaConfiguracao titulo="Exportar dados" dica="Baixa um arquivo JSON com clientes, processos, casos consultivos, colunas, tarefas e etiquetas.">
          <Botao tamanho="sm" onClick={exportar} disabled={exportando}>
            <DownloadSimpleIcon size={15} />
            {exportando ? "Exportando…" : "Exportar"}
          </Botao>
        </LinhaConfiguracao>
        {supabaseConfigurado && projetosNoNavegador > 0 && (
          <LinhaConfiguracao
            titulo="Importar dados deste navegador"
            dica={`Traz para a sua conta ${projetosNoNavegador} ${projetosNoNavegador === 1 ? "caso salvo" : "casos salvos"} no modo local.`}
          >
            <Botao tamanho="sm" onClick={importarDoNavegador} disabled={importando}>
              <UploadSimpleIcon size={15} />
              {importando ? "Importando…" : "Importar"}
            </Botao>
          </LinhaConfiguracao>
        )}
      </div>
    </>
  );
}

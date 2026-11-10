import { z } from "zod";
import type { Desfazer } from "@/domain/tipos";
import type { ContextoAgente } from "./auxiliares";

// Formato comum das ferramentas do servidor MCP e os esquemas de entrada reaproveitados.
// As descrições são fixas: nenhum texto vindo de tarefas, links ou mensagens entra nelas.

export interface ResultadoFerramenta {
  /** Frase curta, pronta para o WhatsApp. */
  mensagem: string;
  /** Dados estruturados para o agente (listas, ids, links). */
  dados?: Record<string, unknown>;
  /** Como reverter (vai para registro_agente.desfazer). */
  desfazer?: Desfazer | null;
}

export interface Ferramenta<E extends z.ZodObject = z.ZodObject> {
  nome: string;
  titulo: string;
  descricao: string;
  /** Altera dados? Tokens de leitura não enxergam estas. */
  escrita: boolean;
  /** Exige `confirmado: true` para aplicar. */
  confirmacao: boolean;
  entrada: E;
  executar(ctx: ContextoAgente, args: z.infer<E>): Promise<ResultadoFerramenta>;
}

export const definir = <E extends z.ZodObject>(f: Ferramenta<E>) => f as unknown as Ferramenta;

export const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Use a data no formato AAAA-MM-DD." });
export const confirmado = z.boolean().default(false).describe("false (padrão) só mostra a prévia. Use true depois que a pessoa disser sim.");
/** Confirmação no WhatsApp: o *sim* entre asteriscos aparece em negrito (manual da marca, Voz e tom). */
export const PEDIR_SIM = "Responda *sim* para confirmar.";
export const PEDIR_SIM_REGISTRAR = "Responda *sim* para registrar.";

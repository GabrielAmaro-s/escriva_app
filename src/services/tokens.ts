import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { EscopoToken, TokenAgente } from "@/domain/tipos";
import type { Repositorio } from "@/data/repositorio";

// Tokens do agente. Só roda no servidor: precisa de MCP_SEGREDO_TOKENS.
// O token em texto puro só existe na resposta de gerarToken; no banco fica o HMAC-SHA256.

const PREFIXO = "myplan_";

export interface ConfiguracaoTokens {
  segredo: string;
  validadeDias: number;
}

export function calcularHashDoToken(token: string, segredo: string): string {
  return createHmac("sha256", segredo).update(token).digest("hex");
}

export async function gerarToken(
  repo: Repositorio,
  dados: { nome: string; escopo: EscopoToken },
  config: ConfiguracaoTokens,
  agora = new Date(),
): Promise<{ token: string; registro: TokenAgente }> {
  const nome = dados.nome.trim();
  if (!nome) throw new Error("Dê um nome para o token (ex.: nanobot da VPS).");
  if (nome.length > 60) throw new Error("O nome do token pode ter até 60 caracteres.");
  if (!config.segredo) throw new Error("Defina MCP_SEGREDO_TOKENS no servidor antes de gerar tokens.");
  const token = PREFIXO + randomBytes(32).toString("base64url");
  const expiraEm = new Date(agora.getTime() + config.validadeDias * 86_400_000).toISOString();
  const registro = await repo.criarTokenAgente({ nome, escopo: dados.escopo, hash: calcularHashDoToken(token, config.segredo), expiraEm });
  return { token, registro };
}

/** O que o servidor MCP sabe sobre um token guardado (inclui o dono). */
export interface TokenGuardado extends TokenAgente {
  userId: string;
  hash: string;
}

export type MotivoTokenInvalido = "formato" | "desconhecido" | "revogado" | "expirado";

/**
 * Confere o token: formato, existência, revogação e validade.
 * `buscarPorHash` consulta a tabela inteira (o servidor ainda não sabe quem é o usuário).
 */
export async function validarToken(
  token: string,
  dependencias: { segredo: string; buscarPorHash: (hash: string) => Promise<TokenGuardado | null>; agora?: Date },
): Promise<{ ok: true; token: TokenGuardado } | { ok: false; motivo: MotivoTokenInvalido }> {
  if (!token.startsWith(PREFIXO) || token.length < PREFIXO.length + 40) return { ok: false, motivo: "formato" };
  const hash = calcularHashDoToken(token, dependencias.segredo);
  const guardado = await dependencias.buscarPorHash(hash);
  if (!guardado || !iguais(guardado.hash, hash)) return { ok: false, motivo: "desconhecido" };
  if (guardado.revogadoEm) return { ok: false, motivo: "revogado" };
  if (new Date(guardado.expiraEm).getTime() <= (dependencias.agora ?? new Date()).getTime()) return { ok: false, motivo: "expirado" };
  return { ok: true, token: guardado };
}

export function revogarToken(repo: Repositorio, id: string, agora = new Date()): Promise<void> {
  return repo.atualizarTokenAgente(id, { revogadoEm: agora.toISOString() });
}

function iguais(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Conflito com um dado que já existe (CPF/CNPJ ou número de processo repetido na conta).
 * A API responde 409 com a mensagem, que já vem pronta para a tela.
 */
export class ErroDeConflito extends Error {}

/** Dado inválido (CPF errado, número de processo errado...). A API responde 400. */
export class ErroDeValidacao extends Error {}

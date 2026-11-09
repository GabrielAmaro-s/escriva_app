import { describe, expect, it } from "vitest";
import { ErroDeConflito } from "@/domain/erros";
import { traduzirErroDoBanco } from "./erros";

describe("erros do banco", () => {
  it("unicidade (23505) vira ErroDeConflito com mensagem clara", () => {
    const cliente = traduzirErroDoBanco({ code: "23505", message: 'duplicate key value violates unique constraint "clientes_usuario_documento_idx"' });
    expect(cliente).toBeInstanceOf(ErroDeConflito);
    expect(cliente.message).toBe("Já existe um cliente com esse CPF/CNPJ.");
    const processo = traduzirErroDoBanco({ code: "23505", message: "duplicate key", details: "processo_detalhes_usuario_cnj_idx" });
    expect(processo.message).toBe("Já existe um processo com esse número.");
  });

  it("cliente de outra conta (chave composta) vira Cliente não encontrado", () => {
    expect(traduzirErroDoBanco({ code: "23503", message: 'violates foreign key constraint "projects_cliente_fk"' }).message).toBe("Cliente não encontrado.");
  });

  it("outros erros passam como vieram", () => {
    const e = traduzirErroDoBanco({ code: "42501", message: "permission denied" });
    expect(e).not.toBeInstanceOf(ErroDeConflito);
    expect(e.message).toBe("permission denied");
  });
});
